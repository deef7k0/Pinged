import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { UsernameAccount } from '@/components/gaming/username-account';
import { Avatar } from '@/components/ui/avatar';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { InsetGroup, Row } from '@/components/ui/inset-group';
import { PageScrollView } from '@/components/ui/page-scroll';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useLinkedAccount } from '@/hooks/use-gaming';
import { updateProfile, uploadImage } from '@/lib/api';
import { displayNameFor } from '@/lib/format';
import { USERNAME_PROVIDERS, type UsernameProviderId } from '@/lib/gaming';
import { useAuth } from '@/store/auth';
import { toast } from '@/lib/toast';

/** SteamID64 is exactly 17 digits — mirrors the CHECK constraint in 0002. */
const STEAM_ID_PATTERN = /^[0-9]{17}$/;

/** Contacts' face: 96. */
const FACE = 96;

/** Which page of the sheet is in front: the profile, or one account's. */
type Page = 'profile' | 'steam' | UsernameProviderId;

/**
 * Edit profile — Contacts' Edit Contact (the Apple pass, 2026-11-05): your
 * face, 96, with **Edit** under it, which picks a photo from the library (it
 * is uploaded on Save); then your name, bio, location and favourite platform
 * as rows of one group; then **Game accounts**, a row a service, each opening
 * its own page in this sheet — Steam's holds the SteamID64, the others their
 * username (`<UsernameAccount>`).
 *
 * It was a column of labelled wells, an "Avatar URL" field ("Image uploads
 * are not built yet — paste a link for now"), the SteamID64 with a paragraph
 * under it, and the three accounts' forms stacked at the foot.
 */
export default function EditProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id);
  const profile = useAuth((state) => state.profile);
  const refreshProfile = useAuth((state) => state.refreshProfile);

  const [page, setPage] = useState<Page>('profile');
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  /** A photo picked on this phone, not yet uploaded. */
  const [pickedPhoto, setPickedPhoto] = useState<string | null>(null);
  const [favoritePlatform, setFavoritePlatform] = useState(profile?.favorite_platform ?? '');
  const [location, setLocation] = useState(profile?.location ?? '');
  const [steamId, setSteamId] = useState(profile?.steam_id ?? '');
  const [steamError, setSteamError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('You must be signed in.');

      const trimmedSteamId = steamId.trim();
      if (trimmedSteamId && !STEAM_ID_PATTERN.test(trimmedSteamId)) {
        setPage('steam');
        throw new Error('SteamID64 must be exactly 17 digits.');
      }

      const avatar = pickedPhoto ? await uploadImage(userId, pickedPhoto, 'avatars') : undefined;

      await updateProfile(userId, {
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        ...(avatar ? { avatar_url: avatar } : {}),
        /* `banner_url` is deliberately not written. The editor no longer offers
           it, so sending `null` here would quietly erase a value the user set
           before the field was removed. Leaving it out of the patch leaves the
           column alone. The same for `avatar_url` when no photo was picked. */
        favorite_platform: favoritePlatform.trim() || null,
        location: location.trim() || null,
        steam_id: trimmedSteamId || null,
      });
    },
    onSuccess: async () => {
      toast.success('Profile saved');
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      router.back();
    },
    onError: (error) => {
      setSteamError(error instanceof Error ? error.message : 'Could not save.');
    },
  });

  /* Android's back returns from an account's page to the profile's, as the
     bar's chevron does, rather than closing the sheet. */
  useEffect(() => {
    if (page === 'profile') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setPage('profile');
      return true;
    });
    return () => sub.remove();
  }, [page]);

  async function pickPhoto() {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!picked.canceled && picked.assets[0]) setPickedPhoto(picked.assets[0].uri);
  }

  const provider = USERNAME_PROVIDERS.find((entry) => entry.id === page) ?? null;
  const pageTitle =
    page === 'profile' ? 'Edit profile' : page === 'steam' ? 'Steam' : (provider?.label ?? '');

  const bar =
    page === 'profile' ? (
      <FrostedTopBar
        dismiss
        title={pageTitle}
        confirm={{ label: 'Save profile', onPress: () => save.mutate(), loading: save.isPending }}
      />
    ) : (
      <FrostedTopBar back onBack={() => setPage('profile')} title={pageTitle} />
    );

  return (
    /* `modal`: an iOS sheet already begins below the status bar, so the bar must
       not inset itself again — see `useTopBarInset`. */
    <Screen edges={['bottom']} padded insetHeader modal topBar={bar}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <PageScrollView
          key={page}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {page === 'profile' ? (
            <>
              <View style={styles.face}>
                <Avatar
                  uri={pickedPhoto ?? profile?.avatar_url}
                  name={displayNameFor(profile)}
                  size={FACE}
                />
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Edit your photo"
                  accessibilityHint="Choose a photo from your library"
                  onPress={() => void pickPhoto()}
                  hitSlop={12}
                  scaleTo={0.95}>
                  <Text variant="h5" color="primaryText">
                    Edit
                  </Text>
                </PressableScale>
              </View>

              <InsetGroup>
                <TextField
                  variant="row"
                  label="Name"
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="How your name appears"
                  maxLength={50}
                />
                <TextField
                  variant="row"
                  label="Bio"
                  value={bio}
                  onChangeText={setBio}
                  placeholder="What you play"
                  multiline
                  maxLength={300}
                  style={styles.bio}
                />
                <TextField
                  variant="row"
                  label="Location"
                  value={location}
                  onChangeText={setLocation}
                  placeholder="Optional"
                />
                <TextField
                  variant="row"
                  label="Platform"
                  value={favoritePlatform}
                  onChangeText={setFavoritePlatform}
                  placeholder="Your favourite"
                  autoCapitalize="words"
                />
              </InsetGroup>

              {/* No banner field — the profile renders none; see `<ProfileView>`. */}

              {save.isError && !steamError?.startsWith('SteamID64') && (
                <Text variant="bodySmall" color="danger" style={styles.note}>
                  {steamError}
                </Text>
              )}

              {userId && (
                <InsetGroup
                  header="Game accounts"
                  footer="Your public games on each service are imported into your library.">
                  <Row
                    title="Steam"
                    value={steamId.trim() ? 'Linked' : 'Not linked'}
                    onPress={() => setPage('steam')}
                  />
                  {USERNAME_PROVIDERS.map((entry) => (
                    <AccountRow
                      key={entry.id}
                      userId={userId}
                      provider={entry.id}
                      label={entry.label}
                      onPress={() => setPage(entry.id)}
                    />
                  ))}
                </InsetGroup>
              )}
            </>
          ) : page === 'steam' ? (
            <InsetGroup footer="Links your Steam account so achievement progress can be synced. Find yours at steamid.io. Your Steam profile and game details must be public, or Steam returns nothing. Saved with your profile.">
              <TextField
                variant="row"
                label="SteamID64"
                value={steamId}
                onChangeText={(value) => {
                  setSteamId(value);
                  setSteamError(null);
                }}
                placeholder="76561197960287930"
                keyboardType="number-pad"
                autoCapitalize="none"
                error={steamError?.startsWith('SteamID64') ? steamError : null}
              />
            </InsetGroup>
          ) : userId && provider ? (
            /* Each connects on its own button, not on Save: an import is a
               request to the service, and its answer is shown where it was
               asked. */
            <UsernameAccount userId={userId} provider={provider.id} />
          ) : null}
        </PageScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** A linked service's row: its name, and the name it is linked as. */
function AccountRow({
  userId,
  provider,
  label,
  onPress,
}: {
  userId: string;
  provider: UsernameProviderId;
  label: string;
  onPress: () => void;
}) {
  const account = useLinkedAccount(userId, provider);
  const linked = account.data ? (account.data.handle ?? account.data.externalId) : null;
  return <Row title={label} value={linked ?? 'Not linked'} onPress={onPress} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: Spacing.x24, paddingVertical: Spacing.x24 },
  face: { alignItems: 'center', gap: Spacing.x8 },
  bio: { maxHeight: 160 },
  note: { paddingHorizontal: Spacing.x16 },
});

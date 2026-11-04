import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { UsernameAccount } from '@/components/gaming/username-account';
import { Button } from '@/components/ui/button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageScrollView } from '@/components/ui/page-scroll';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { updateProfile } from '@/lib/api';
import { USERNAME_PROVIDERS } from '@/lib/gaming';
import { useAuth } from '@/store/auth';
import { toast } from '@/lib/toast';

/** SteamID64 is exactly 17 digits — mirrors the CHECK constraint in 0002. */
const STEAM_ID_PATTERN = /^[0-9]{17}$/;

export default function EditProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id);
  const profile = useAuth((state) => state.profile);
  const refreshProfile = useAuth((state) => state.refreshProfile);

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '');
  const [favoritePlatform, setFavoritePlatform] = useState(profile?.favorite_platform ?? '');
  const [location, setLocation] = useState(profile?.location ?? '');
  const [steamId, setSteamId] = useState(profile?.steam_id ?? '');
  const [steamError, setSteamError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('You must be signed in.');

      const trimmedSteamId = steamId.trim();
      if (trimmedSteamId && !STEAM_ID_PATTERN.test(trimmedSteamId)) {
        throw new Error('SteamID64 must be exactly 17 digits.');
      }

      await updateProfile(userId, {
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        /* `banner_url` is deliberately not written. The editor no longer offers
           it, so sending `null` here would quietly erase a value the user set
           before the field was removed — a destructive side effect of saving an
           unrelated change. Leaving it out of the patch leaves the column alone. */
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

  return (
    /* `modal`: an iOS sheet already begins below the status bar, so the bar must
       not inset itself again — see `useTopBarInset`. `dismiss` for the same
       reason the chevron is wrong here: a sheet closes, it does not go back. */
    <Screen
      edges={['bottom']}
      padded
      insetHeader
      modal
      topBar={<FrostedTopBar dismiss title="Edit profile" />}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <PageScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <TextField
            label="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="How your name appears"
            maxLength={50}
          />

          <TextField
            label="Bio"
            value={bio}
            onChangeText={setBio}
            placeholder="Tell people what you play"
            multiline
            maxLength={300}
          />

          <TextField
            label="Avatar URL"
            value={avatarUrl}
            onChangeText={setAvatarUrl}
            placeholder="https://…"
            autoCapitalize="none"
            keyboardType="url"
            hint="Image uploads are not built yet — paste a link for now."
          />

          {/* No banner field. The profile no longer renders one — see the note
              on `<ProfileView>`. `profiles.banner_url` is left in the schema and
              in the types rather than dropped, the same way the `posts` tables
              were: a migration to remove a column nothing reads buys nothing and
              cannot be undone. Any value already stored is simply not shown. */}

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <TextField
                label="Favourite platform"
                value={favoritePlatform}
                onChangeText={setFavoritePlatform}
                placeholder="PS5"
                autoCapitalize="words"
              />
            </View>
            <View style={styles.rowItem}>
              <TextField
                label="Location"
                value={location}
                onChangeText={setLocation}
                placeholder="Optional"
              />
            </View>
          </View>

          <View style={styles.steamBlock}>
            <TextField
              label="SteamID64"
              value={steamId}
              onChangeText={(value) => {
                setSteamId(value);
                setSteamError(null);
              }}
              placeholder="76561197960287930"
              keyboardType="number-pad"
              autoCapitalize="none"
              error={steamError}
            />
            <Text variant="bodySmall" color="textMuted">
              Links your Steam account so achievement progress can be synced. Find yours at
              steamid.io. Your Steam profile and game details must be set to public, otherwise Steam
              returns nothing.
            </Text>
          </View>

          {/* PlayStation, Xbox and GOG by username, as RAWG links them. Each
              connects on its own button, not on Save: an import is a request
              to the service, and its answer is shown where it was asked. */}
          {userId && (
            <View style={styles.accounts}>
              <Text variant="h4">Game accounts</Text>
              <Text variant="bodySmall" color="textMuted">
                Type the name you use on each service and your public games are imported into your
                library.
              </Text>
              {USERNAME_PROVIDERS.map((provider) => (
                <UsernameAccount key={provider.id} userId={userId} provider={provider.id} />
              ))}
            </View>
          )}

          <Button
            title="Save profile"
            onPress={() => save.mutate()}
            loading={save.isPending}
            fullWidth
          />
        </PageScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: Spacing.x16, paddingVertical: Spacing.x24 },
  row: { flexDirection: 'row', gap: Spacing.x12 },
  rowItem: { flex: 1 },
  steamBlock: { gap: Spacing.x8 },
  accounts: { gap: Spacing.x12 },
});

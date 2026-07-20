// components/StoryBar.js
//
// Drop at the top of the Feed screen, replacing the mock STORIES row.
//
// Usage:
//   const [storyGroups, setStoryGroups] = useState([]);
//   useEffect(() => { getActiveStories(currentUserId).then(setStoryGroups); }, []);
//   <StoryBar
//     groups={storyGroups}
//     currentUserId={me.id}
//     currentUserAvatar={me.avatar_url}
//     onAddStory={handleAddStory}      // calls pickAndUploadImage + createStory
//     onViewGroup={(group) => setViewerGroup(group)}  // opens StoryViewer
//   />

import React from "react";
import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet } from "react-native";
import { Plus } from "lucide-react-native";

const TONE_BG = ["#101B33", "#3D1219", "#0F2318", "#25101F", "#161821"];

function toneFor(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash + userId.charCodeAt(i)) % TONE_BG.length;
  return TONE_BG[hash];
}

export default function StoryBar({ groups, currentUserId, currentUserAvatar, onAddStory, onViewGroup }) {
  const myGroup = groups.find((g) => g.author.id === currentUserId);
  const otherGroups = groups.filter((g) => g.author.id !== currentUserId);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row} contentContainerStyle={styles.rowContent}>
      {/* Your story slot — always first, shows + if you have none yet */}
      <TouchableOpacity
        style={styles.item}
        onPress={() => (myGroup ? onViewGroup(myGroup) : onAddStory())}
        onLongPress={onAddStory}
      >
        <View style={styles.avatarWrap}>
          {currentUserAvatar ? (
            <Image source={{ uri: currentUserAvatar }} style={[styles.avatar, myGroup && styles.avatarRing]} />
          ) : (
            <View style={[styles.avatarPlaceholder, myGroup && styles.avatarRing]}>
              <Text style={styles.avatarInitials}>You</Text>
            </View>
          )}
          {!myGroup && (
            <TouchableOpacity style={styles.addBadge} onPress={onAddStory}>
              <Plus size={12} color="#161209" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.label} numberOfLines={1}>Your Story</Text>
      </TouchableOpacity>

      {otherGroups.map((group) => (
        <TouchableOpacity key={group.author.id} style={styles.item} onPress={() => onViewGroup(group)}>
          <View style={styles.avatarWrap}>
            {group.author.avatar_url ? (
              <Image source={{ uri: group.author.avatar_url }} style={[styles.avatar, styles.avatarRing]} />
            ) : (
              <View style={[styles.avatarPlaceholder, styles.avatarRing, { backgroundColor: toneFor(group.author.id) }]}>
                <Text style={styles.avatarInitials}>{initials(group.author.display_name)}</Text>
              </View>
            )}
          </View>
          <Text style={styles.label} numberOfLines={1}>{group.author.display_name.split(" ")[0]}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function initials(name) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const styles = StyleSheet.create({
  row: { borderBottomWidth: 1, borderBottomColor: "#24242C" },
  rowContent: { paddingHorizontal: 16, paddingVertical: 14, gap: 16 },
  item: { alignItems: "center", width: 56 },
  avatarWrap: { position: "relative" },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarPlaceholder: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#161821", justifyContent: "center", alignItems: "center" },
  avatarRing: { borderWidth: 2, borderColor: "#C9A45C" },
  avatarInitials: { color: "#C8CAD6", fontSize: 13, fontWeight: "600" },
  addBadge: {
    position: "absolute", bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9,
    backgroundColor: "#C9A45C", justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: "#0A0A0E",
  },
  label: { color: "#9A98A6", fontSize: 11, marginTop: 6, textAlign: "center" },
});

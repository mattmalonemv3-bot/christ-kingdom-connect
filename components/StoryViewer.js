import React, { useState, useEffect, useRef } from "react";
import { View, Image, TouchableOpacity, Text, StyleSheet, Animated, Dimensions } from "react-native";
import { Video, ResizeMode } from "expo-av";
import { X, Volume2, VolumeX } from "lucide-react-native";

const IMAGE_DURATION_MS = 5000;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function StoryViewer({ group, onClose }) {
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const progress = useRef(new Animated.Value(0)).current;
  const videoRef = useRef(null);

  const current = group?.stories[index];
  const isVideo = current?.media_type === "video";

  useEffect(() => {
    if (!group) return;
    progress.setValue(0);
    if (isVideo) return;
    const anim = Animated.timing(progress, { toValue: 1, duration: IMAGE_DURATION_MS, useNativeDriver: false });
    anim.start(({ finished }) => finished && advance());
    return () => anim.stop();
  }, [index, group]);

  if (!group || !current) return null;

  const advance = () => {
    if (index < group.stories.length - 1) setIndex((i) => i + 1);
    else onClose();
  };

  const goBack = () => {
    if (index > 0) setIndex((i) => i - 1);
  };

  const handleVideoStatus = (status) => {
    if (!status.isLoaded) return;
    if (status.durationMillis) progress.setValue(status.positionMillis / status.durationMillis);
    if (status.didJustFinish) advance();
  };

  return (
    <View style={styles.container}>
      {isVideo ? (
        <Video
          ref={videoRef}
          source={{ uri: current.media_url }}
          style={styles.media}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isMuted={muted}
          onPlaybackStatusUpdate={handleVideoStatus}
        />
      ) : (
        <Image source={{ uri: current.media_url }} style={styles.media} resizeMode="cover" />
      )}

      <View style={styles.tapZones}>
        <TouchableOpacity style={styles.tapLeft} onPress={goBack} activeOpacity={1} />
        <TouchableOpacity style={styles.tapRight} onPress={advance} activeOpacity={1} />
      </View>

      <View style={styles.progressRow}>
        {group.stories.map((s, i) => (
          <View key={s.id} style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width:
                    i < index ? "100%" : i === index
                      ? progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] })
                      : "0%",
                },
              ]}
            />
          </View>
        ))}
      </View>

      <View style={styles.header}>
        <View style={styles.authorRow}>
          {group.author.avatar_url && <Image source={{ uri: group.author.avatar_url }} style={styles.authorAvatar} />}
          <Text style={styles.authorName}>{group.author.display_name}</Text>
          <Text style={styles.timeLabel}>{timeAgo(current.created_at)}</Text>
        </View>
        <View style={styles.headerRight}>
          {isVideo && (
            <TouchableOpacity onPress={() => setMuted((m) => !m)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              {muted ? <VolumeX size={20} color="#F2EFE9" /> : <Volume2 size={20} color="#F2EFE9" />}
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <X size={22} color="#F2EFE9" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function timeAgo(iso) {
  const hrs = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (hrs < 1) return "just now";
  return `${hrs}h ago`;
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000", zIndex: 50 },
  media: { width: SCREEN_WIDTH, height: "100%" },
  progressRow: { position: "absolute", top: 54, left: 12, right: 12, flexDirection: "row", gap: 4 },
  progressTrack: { flex: 1, height: 2.5, backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#F2EFE9" },
  header: { position: "absolute", top: 66, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  authorAvatar: { width: 30, height: 30, borderRadius: 15 },
  authorName: { color: "#F2EFE9", fontSize: 13, fontWeight: "600" },
  timeLabel: { color: "#C8C6D0", fontSize: 12 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 16 },
  tapZones: { ...StyleSheet.absoluteFillObject, flexDirection: "row" },
  tapLeft: { flex: 1 },
  tapRight: { flex: 2 },
});

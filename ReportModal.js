// components/ReportModal.js
//
// Reusable report sheet. Drop this once near the root of your app
// (e.g. in App.js) and control it from anywhere with the
// useReportModal() hook below — call openReport({ targetType, targetId })
// from a "Report" button on any post, comment, prayer request, or profile.
//
// Usage:
//   const { ReportModal, openReport } = useReportModal(currentUserId);
//   <ReportModal />
//   ...
//   <TouchableOpacity onPress={() => openReport({ targetType: 'post', targetId: post.id })}>
//     <Text>Report</Text>
//   </TouchableOpacity>

import React, { useState, useCallback } from "react";
import { View, Text, Modal, TouchableOpacity, TextInput, StyleSheet, Alert } from "react-native";
import { reportContent } from "../lib/moderation";

const REASONS = [
  { key: "spam", label: "Spam or scam" },
  { key: "harassment", label: "Harassment or bullying" },
  { key: "hate_speech", label: "Hate speech" },
  { key: "sexual_content", label: "Sexual content" },
  { key: "violence", label: "Violence or threats" },
  { key: "impersonation", label: "Impersonating someone" },
  { key: "other", label: "Something else" },
];

export function useReportModal(currentUserId) {
  const [visible, setVisible] = useState(false);
  const [target, setTarget] = useState(null); // { targetType, targetId }

  const openReport = useCallback(({ targetType, targetId }) => {
    setTarget({ targetType, targetId });
    setVisible(true);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    setTarget(null);
  }, []);

  const ReportModalComponent = useCallback(
    () => (
      <ReportModal
        visible={visible}
        target={target}
        currentUserId={currentUserId}
        onClose={close}
      />
    ),
    [visible, target, currentUserId, close]
  );

  return { ReportModal: ReportModalComponent, openReport };
}

function ReportModal({ visible, target, currentUserId, onClose }) {
  const [selectedReason, setSelectedReason] = useState(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setSelectedReason(null);
    setDetails("");
    setSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedReason || !target) return;
    setSubmitting(true);
    try {
      await reportContent({
        reporterId: currentUserId,
        targetType: target.targetType,
        targetId: target.targetId,
        reason: selectedReason,
        details: details.trim() || null,
      });
      Alert.alert("Report submitted", "Thanks for helping keep this community safe. Our team will review it.");
      handleClose();
    } catch (err) {
      Alert.alert("Something went wrong", "Your report couldn't be submitted. Please try again.");
      setSubmitting(false);
    }
  };

  if (!target) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Report this {labelForType(target.targetType)}</Text>
          <Text style={styles.subtitle}>Why are you reporting this?</Text>

          {REASONS.map((r) => (
            <TouchableOpacity
              key={r.key}
              style={[styles.reasonRow, selectedReason === r.key && styles.reasonRowActive]}
              onPress={() => setSelectedReason(r.key)}
            >
              <View style={[styles.radio, selectedReason === r.key && styles.radioActive]} />
              <Text style={styles.reasonLabel}>{r.label}</Text>
            </TouchableOpacity>
          ))}

          <TextInput
            style={styles.detailsInput}
            placeholder="Add details (optional)"
            placeholderTextColor="#7C7A88"
            value={details}
            onChangeText={setDetails}
            multiline
          />

          <TouchableOpacity
            style={[styles.submitButton, !selectedReason && styles.submitButtonDisabled]}
            disabled={!selectedReason || submitting}
            onPress={handleSubmit}
          >
            <Text style={styles.submitButtonText}>{submitting ? "Submitting…" : "Submit report"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function labelForType(type) {
  return (
    {
      post: "post",
      comment: "comment",
      prayer_request: "prayer request",
      profile: "profile",
      group: "group",
      stream_chat_message: "message",
    }[type] || "content"
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0F0F14", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#2E3140", alignSelf: "center", marginBottom: 16 },
  title: { color: "#F2EFE9", fontSize: 18, fontWeight: "600", marginBottom: 4 },
  subtitle: { color: "#9A98A6", fontSize: 13, marginBottom: 16 },
  reasonRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#1C1C24" },
  reasonRowActive: {},
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#3A3A44", marginRight: 12 },
  radioActive: { borderColor: "#C9A45C", backgroundColor: "#C9A45C" },
  reasonLabel: { color: "#D8D5C9", fontSize: 15 },
  detailsInput: {
    color: "#F2EFE9", borderWidth: 1, borderColor: "#24242C", borderRadius: 12,
    padding: 12, minHeight: 70, marginTop: 16, marginBottom: 16, textAlignVertical: "top",
  },
  submitButton: { backgroundColor: "#C9A45C", borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  submitButtonDisabled: { backgroundColor: "#3A3020" },
  submitButtonText: { color: "#161209", fontWeight: "700", fontSize: 15 },
  cancelButton: { paddingVertical: 14, alignItems: "center" },
  cancelButtonText: { color: "#9A98A6", fontSize: 14 },
});

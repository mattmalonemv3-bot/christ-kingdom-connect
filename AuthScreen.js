// screens/AuthScreen.js
import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from "react-native";
import { Crown } from "lucide-react-native";
import { signIn, signUp } from "../lib/auth";
import { colors } from "../theme";

export default function AuthScreen() {
  const [mode, setMode] = useState("signIn"); // 'signIn' | 'signUp'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password || (mode === "signUp" && (!username || !displayName))) {
      Alert.alert("Missing info", "Please fill in every field.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signIn") {
        await signIn({ email, password });
      } else {
        const { session } = await signUp({ email, password, username, displayName });
        if (!session) {
          Alert.alert("Check your email", "Confirm your email address to finish creating your account.");
        }
      }
      // Auth state change is picked up by App.js's onAuthStateChange listener —
      // nothing else to do here on success.
    } catch (err) {
      Alert.alert(mode === "signIn" ? "Couldn't sign in" : "Couldn't create account", err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Crown size={32} color={colors.gold} fill={colors.gold} />
        <Text style={styles.appName}>Christ Kingdom Connect</Text>
        <Text style={styles.tagline}>A community for believers everywhere</Text>
      </View>

      <View style={styles.form}>
        {mode === "signUp" && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Display name"
              placeholderTextColor={colors.textFaint}
              value={displayName}
              onChangeText={setDisplayName}
            />
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor={colors.textFaint}
              value={username}
              onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              autoCapitalize="none"
            />
          </>
        )}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textFaint}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textFaint}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={styles.submitButtonText}>{mode === "signIn" ? "Sign In" : "Create Account"}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setMode(mode === "signIn" ? "signUp" : "signIn")}>
          <Text style={styles.switchText}>
            {mode === "signIn" ? "New here? Create an account" : "Already have an account? Sign in"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", paddingHorizontal: 28 },
  header: { alignItems: "center", marginBottom: 40 },
  appName: { color: colors.text, fontSize: 22, fontWeight: "700", marginTop: 10 },
  tagline: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  form: { gap: 12 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, color: colors.text, fontSize: 15,
  },
  submitButton: {
    backgroundColor: colors.gold, borderRadius: 999, paddingVertical: 15,
    alignItems: "center", marginTop: 8,
  },
  submitButtonText: { color: "#161209", fontWeight: "700", fontSize: 15 },
  switchText: { color: colors.textMuted, fontSize: 13, textAlign: "center", marginTop: 16 },
});

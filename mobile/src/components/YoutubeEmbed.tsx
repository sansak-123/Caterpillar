// Native (Android/iOS): a real YouTube video inside a WebView, same embedding approach
// as UnitySim.tsx uses for the Unity WebGL build. See YoutubeEmbed.web.tsx for the web
// variant (a plain iframe, matching UnitySim.web.tsx's pattern).
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

export function YoutubeEmbed({ videoId }: { videoId: string }) {
  return (
    <View style={styles.wrap}>
      <WebView
        source={{ uri: `https://www.youtube.com/embed/${videoId}?playsinline=1` }}
        style={styles.frame}
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: "hidden",
  },
  frame: {
    flex: 1,
    backgroundColor: "#000000",
  },
});

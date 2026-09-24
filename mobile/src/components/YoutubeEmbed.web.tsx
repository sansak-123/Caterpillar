/// <reference lib="dom" />
// Web (npx expo start --web): a plain iframe, same pattern as UnitySim.web.tsx.
export function YoutubeEmbed({ videoId }: { videoId: string }) {
  return (
    <iframe
      src={`https://www.youtube.com/embed/${videoId}`}
      title="Training video"
      style={{ border: 0, width: "100%", aspectRatio: "16 / 9", borderRadius: 16, display: "block", background: "#000000" }}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  );
}

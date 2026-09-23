/// <reference lib="dom" />
// Web version (npx expo start --web): Unity runs in an iframe served from mobile/public/sim.
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { SIM_URL, parseSimMessage, type SimCommand, type UnitySimHandle, type UnitySimProps } from "../lib/unity/bridge";

const UnitySim = forwardRef<UnitySimHandle, UnitySimProps>(function UnitySim({ onMessage }, ref) {
  const frame = useRef<HTMLIFrameElement>(null);

  useImperativeHandle(ref, () => ({
    send(cmd: SimCommand) {
      frame.current?.contentWindow?.postMessage({ target: "unity-sim", ...cmd }, "*");
    },
  }), []);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const msg = parseSimMessage(e.data);
      if (msg) onMessage(msg);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onMessage]);

  return (
    <iframe
      ref={frame}
      src={SIM_URL}
      title="Excavator training simulator"
      style={{ border: 0, width: "100%", height: "100%", minHeight: 420, display: "block", background: "#2a2d30" }}
    />
  );
});

export default UnitySim;
export { UnitySim };
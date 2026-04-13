import Spline from "@splinetool/react-spline";
import { useState, useEffect, useRef } from "react";

function useResponsiveStyles() {
  const [style, setStyle] = useState({ width: "80%", height: "70vh" });

  useEffect(() => {
    const updateStyle = () => {
      const width = window.innerWidth;

      if (width < 640) {
        // Mobile
        setStyle({ width: "80%", height: "70vh" });
      } else if (width < 1024) {
        // Tablet
        setStyle({ width: "90%", height: "60vh" });
      } else {
        // Desktop
        setStyle({ width: "80%", height: "70vh" });
      }
    };

    updateStyle();
    window.addEventListener("resize", updateStyle);
    return () => window.removeEventListener("resize", updateStyle);
  }, []);

  return style;
}

export default function VoiceAssistantModel({ isSpeaking }) {
  const style = useResponsiveStyles();
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.src = isSpeaking ? "/avatar.mp4" : "/avatar-silent.mp4";
      videoRef.current.play();
    }
  }, [isSpeaking]);

  return (
    <video
      ref={videoRef}
      style={style}
      src="/avatar-silent.mp4"
      autoPlay
      loop
      muted
      playsInline
    />
  );
}
 
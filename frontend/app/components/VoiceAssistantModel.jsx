import Spline from "@splinetool/react-spline";
import { useState, useEffect } from "react";

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

export default function VoiceAssistantModel() {
  const style = useResponsiveStyles();

  return (
    <Spline
      style={style}
      scene="https://prod.spline.design/Jk4XxrRtpPJPLnlF/scene.splinecode"
    />
  );
}

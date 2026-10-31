import type { MetadataRoute } from "next";

// Lets the worker app open full screen from the phone's home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Flexa",
    short_name: "Flexa",
    description: "Tu salario. A tu ritmo.",
    start_url: "/app/login",
    display: "standalone",
    background_color: "#fbfdfb",
    theme_color: "#fbfdfb",
  };
}

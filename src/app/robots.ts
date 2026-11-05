import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/settings",
          "/create",
          "/api",
          "/f/*/settings",
          "/f/*/pages",
        ],
      },
    ],
  };
}

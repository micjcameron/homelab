import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// Required for `output: "export"` — render this route to a static file at build time.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${site.url}/sitemap.xml`,
  };
}

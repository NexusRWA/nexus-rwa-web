/**
 * Tests for app/manifest.ts
 *
 * Strategy: The manifest function generates a PWA web manifest object that
 * defines how the web app appears when installed. This test verifies the
 * manifest has all required fields per the Web App Manifest spec and that
 * the values are correct for the Nexus RWA application.
 *
 * Coverage:
 *   1. Manifest has all required fields (name, short_name, icons, etc.)
 *   2. Display mode is "standalone" (PWA installable)
 *   3. Theme and background colors are correct (dark theme)
 *   4. Icons array has correct structure and paths
 *   5. Start URL is "/"
 *   6. Description is present and meaningful
 */

import manifest from "./manifest";

describe("app/manifest.ts", () => {
  const manifestData = manifest();

  it("returns a valid manifest object", () => {
    expect(manifestData).toBeDefined();
    expect(typeof manifestData).toBe("object");
  });

  it("has the correct app name", () => {
    expect(manifestData.name).toBe("Nexus RWA");
  });

  it("has the correct short name", () => {
    expect(manifestData.short_name).toBe("Nexus RWA");
  });

  it("has a meaningful description", () => {
    expect(manifestData.description).toBeDefined();
    expect(typeof manifestData.description).toBe("string");
    expect(manifestData.description!.length).toBeGreaterThan(0);
    expect(manifestData.description).toContain("Stellar");
    expect(manifestData.description).toContain("asset");
  });

  it("has start_url set to root", () => {
    expect(manifestData.start_url).toBe("/");
  });

  it("has display mode set to standalone", () => {
    expect(manifestData.display).toBe("standalone");
  });

  it("has a background color set to dark theme", () => {
    expect(manifestData.background_color).toBe("#08090c");
  });

  it("has a theme color set to dark theme", () => {
    expect(manifestData.theme_color).toBe("#08090c");
  });

  it("background and theme colors match", () => {
    expect(manifestData.background_color).toBe(manifestData.theme_color);
  });

  it("has an icons array", () => {
    expect(manifestData.icons).toBeDefined();
    expect(Array.isArray(manifestData.icons)).toBe(true);
    expect(manifestData.icons!.length).toBeGreaterThan(0);
  });

  it("has at least one icon with the required fields", () => {
    expect(manifestData.icons!.length).toBeGreaterThanOrEqual(1);

    manifestData.icons!.forEach((icon) => {
      expect(icon.src).toBeDefined();
      expect(typeof icon.src).toBe("string");
      expect(icon.sizes).toBeDefined();
      expect(typeof icon.sizes).toBe("string");
      expect(icon.type).toBeDefined();
      expect(typeof icon.type).toBe("string");
    });
  });

  it("includes a 32x32 icon for favicon", () => {
    const faviconIcon = manifestData.icons!.find((icon) => icon.sizes === "32x32");
    expect(faviconIcon).toBeDefined();
    expect(faviconIcon?.src).toBe("/icon");
    expect(faviconIcon?.type).toBe("image/png");
  });

  it("includes a 180x180 apple touch icon", () => {
    const appleTouchIcon = manifestData.icons!.find((icon) => icon.sizes === "180x180");
    expect(appleTouchIcon).toBeDefined();
    expect(appleTouchIcon?.src).toBe("/apple-icon");
    expect(appleTouchIcon?.type).toBe("image/png");
  });

  it("all icons have image/png type", () => {
    manifestData.icons!.forEach((icon) => {
      expect(icon.type).toBe("image/png");
    });
  });

  it("icon sources reference the correct icon handlers", () => {
    const sources = manifestData.icons!.map((icon) => icon.src);
    expect(sources).toContain("/icon");
    expect(sources).toContain("/apple-icon");
  });

  it("manifest is not missing any critical PWA fields", () => {
    // A minimal valid PWA manifest needs at least these fields
    const criticalFields = ["name", "icons"];
    criticalFields.forEach((field) => {
      expect(manifestData).toHaveProperty(field);
    });
  });

  it("maintains consistent format across multiple invocations", () => {
    const manifest1 = manifest();
    const manifest2 = manifest();

    expect(manifest1).toEqual(manifest2);
  });
});

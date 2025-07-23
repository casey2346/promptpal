// src/utils/plugin.ts

export function loadPlugin(pluginPath: string): (input: any) => any {
  try {
    const plugin = require(pluginPath);
    if (typeof plugin !== "function" && typeof plugin.default !== "function") {
      throw new Error("Plugin must export a function as default or module.exports");
    }
    return plugin.default || plugin;
  } catch (err) {
    console.error("❌ Failed to load plugin:", err);
    process.exit(1);
  }
}

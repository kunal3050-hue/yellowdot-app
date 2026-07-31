/**
 * registry-register.mjs — registers registry-loader.mjs as an ESM hook.
 * Used only by `npm run verify:registry`; never part of a build.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./registry-loader.mjs", pathToFileURL("./"));

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAssetCommands = registerAssetCommands;
const output = __importStar(require("../output"));
function registerAssetCommands(program, getClient) {
    const assets = program.command("assets").description("Inspect governed AI system assets and reviewed topology");
    assets.command("list")
        .option("--type <type>", "Asset type")
        .option("--source <source>", "Source system")
        .option("--state <state>", "Lifecycle state")
        .option("-l, --limit <n>", "Max results", "50")
        .option("--offset <n>", "Offset", "0")
        .action(async (opts) => output.json(await getClient().listAiSystemAssets({
        assetType: opts.type, sourceSystem: opts.source, lifecycleState: opts.state,
        limit: Number(opts.limit), offset: Number(opts.offset),
    })));
    assets.command("show <id>")
        .description("Show one asset and its reviewed relationships")
        .action(async (id) => output.json(await getClient().getAiSystemAsset(id)));
}
//# sourceMappingURL=assets.js.map
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
exports.ignored = ignored;
exports.hashFile = hashFile;
exports.scan = scan;
exports.planChanges = planChanges;
exports.readSnapshot = readSnapshot;
exports.safeRelative = safeRelative;
exports.saveSnapshot = saveSnapshot;
exports.acknowledgeVersions = acknowledgeVersions;
exports.backupSnapshot = backupSnapshot;
/** Incremental deployment snapshot. Only successfully uploaded files become tracked. */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
function ignored(relative, patterns) {
    const parts = relative.split('/');
    return parts.some(part => patterns.some(pattern => {
        if (pattern.startsWith('*'))
            return part.endsWith(pattern.slice(1));
        return part === pattern;
    }));
}
function hashFile(file) {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function scan(root, ignore) {
    const result = {};
    function visit(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            const relative = path.relative(root, full).split(path.sep).join('/');
            if (ignored(relative, ignore))
                continue;
            if (entry.isSymbolicLink())
                continue; // Never follow links outside deployment root.
            if (entry.isDirectory())
                visit(full);
            else if (entry.isFile())
                result[relative] = hashFile(full);
        }
    }
    visit(root);
    return result;
}
function planChanges(current, previous, ignore) {
    const upload = Object.keys(current).filter(p => current[p] !== previous[p]).sort();
    const remove = Object.keys(previous).filter(p => !(p in current) && !ignored(p, ignore)).sort();
    return { upload, remove, unchanged: Object.keys(current).length - upload.length };
}
function readSnapshot(file) {
    if (!fs.existsSync(file))
        return {};
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data))
        throw new Error('Invalid deployment manifest');
    const result = {};
    for (const [key, value] of Object.entries(data)) {
        if (!safeRelative(key) || typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))
            throw new Error('Invalid deployment manifest entry');
        result[key] = value;
    }
    return result;
}
function safeRelative(p) {
    return !!p && !p.startsWith('/') && !p.includes('\\') && p.split('/').every(x => x !== '..' && x !== '.' && x !== '');
}
function saveSnapshot(file, state) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    try {
        fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
        fs.renameSync(tmp, file);
    }
    finally {
        if (fs.existsSync(tmp))
            fs.unlinkSync(tmp);
    }
}
/**
 * Mark only the exact, currently scanned file versions as already deployed.
 * A subsequent content change will automatically make the file eligible again.
 * The caller is responsible for verifying the scan against the user's preview.
 */
function acknowledgeVersions(previous, current, selected) {
    const next = { ...previous };
    for (const rel of selected) {
        if (!safeRelative(rel) || !Object.prototype.hasOwnProperty.call(current, rel)) {
            throw new Error(`Invalid or missing queue item: ${rel}`);
        }
        next[rel] = current[rel];
    }
    return next;
}
/** Create a recoverable pre-mutation backup; never overwrite an existing backup. */
function backupSnapshot(file) {
    if (!fs.existsSync(file))
        return undefined;
    const backup = `${file}.${new Date().toISOString().replace(/[:.]/g, '-')}.${crypto.randomBytes(4).toString('hex')}.bak`;
    fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
    return backup;
}
//# sourceMappingURL=incremental.js.map
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

export const DSH_HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')
export const PROFILE_DIR = process.env.DSH_PROFILE_DIR ?? join(DSH_HOME, 'profiles', 'desktop')
export const RESOURCES = process.env.DSKIN_RESOURCES_DIR ?? join(
  process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'),
  'Programs', 'DeepSeek Harness', 'resources',
)
export const DSH_ROOT = process.env.DSKIN_DSH_ROOT ?? join(tmpdir(), 'dsh-desktop-mirror', 'dsh')
export const EDGE = process.env.DSKIN_BROWSER ?? join(
  process.env['ProgramFiles(x86)'] ?? process.env.ProgramFiles ?? 'C:/Program Files (x86)',
  'Microsoft', 'Edge', 'Application', 'msedge.exe',
)

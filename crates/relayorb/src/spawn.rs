//! Resolving the server command the way a shell would.

use std::path::PathBuf;

/// The program to launch for `name`.
///
/// On Windows, a bare name like `npx` or `uvx` is usually a `.cmd`/`.bat` shim, which
/// `std::process::Command` only finds as `.exe`. Search `PATH` with `PATHEXT` like `cmd.exe`
/// does, so MCP configs that say `"command": "npx"` work unchanged. Elsewhere, the name is
/// returned as is and the OS resolves it.
pub fn program(name: &str) -> PathBuf {
    #[cfg(windows)]
    {
        if let Some(found) = search_windows(name) {
            return found;
        }
    }
    PathBuf::from(name)
}

#[cfg(windows)]
fn search_windows(name: &str) -> Option<PathBuf> {
    use std::path::Path;

    let path = Path::new(name);
    if path.extension().is_some() || path.components().count() > 1 {
        return None; // already explicit: npx.cmd, C:\tools\server.exe, .\server
    }
    let exts = std::env::var("PATHEXT").unwrap_or_else(|_| ".COM;.EXE;.BAT;.CMD".into());
    let dirs = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&dirs) {
        for ext in exts.split(';').filter(|e| !e.is_empty()) {
            let candidate = dir.join(format!("{name}{}", ext.to_ascii_lowercase()));
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    #[test]
    fn non_windows_names_pass_through() {
        if cfg!(not(windows)) {
            assert_eq!(super::program("npx"), std::path::PathBuf::from("npx"));
        }
    }

    #[cfg(windows)]
    #[test]
    fn finds_cmd_shims_on_windows() {
        let dir = std::env::temp_dir().join("relayorb-spawn-test");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("fakeshim.cmd"), "@echo off\r\n").unwrap();
        let old = std::env::var_os("PATH").unwrap_or_default();
        let mut paths = vec![dir.clone()];
        paths.extend(std::env::split_paths(&old));
        std::env::set_var("PATH", std::env::join_paths(paths).unwrap());
        assert_eq!(super::program("fakeshim"), dir.join("fakeshim.cmd"));
    }
}

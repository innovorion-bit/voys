use serde::Serialize;
use std::sync::{
    Arc, Mutex,
    atomic::{AtomicBool, AtomicU64, Ordering},
};
use std::thread::{self, JoinHandle};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PttStatePayload {
    pub pressed: bool,
    pub generation: u64,
    pub is_foreground_self: bool,
    pub ctrl_down: bool,
    pub alt_down: bool,
    pub meta_down: bool,
}

struct PttSession {
    stop: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
}

#[derive(Default)]
pub struct PttController {
    generation: AtomicU64,
    session: Mutex<Option<PttSession>>,
}

impl PttController {
    fn stop_locked(guard: &mut Option<PttSession>) {
        if let Some(mut session) = guard.take() {
            session.stop.store(true, Ordering::SeqCst);
            if let Some(handle) = session.handle.take() {
                handle.thread().unpark();
                let _ = handle.join();
            }
        }
    }

    pub fn stop(&self) {
        self.generation.fetch_add(1, Ordering::SeqCst);
        if let Ok(mut guard) = self.session.lock() {
            Self::stop_locked(&mut guard);
        }
    }
}

#[cfg(target_os = "windows")]
mod win {
    use super::*;

    #[link(name = "user32")]
    unsafe extern "system" {
        fn GetAsyncKeyState(vKey: i32) -> i16;
        fn MapVirtualKeyW(uCode: u32, uMapType: u32) -> u32;
        fn GetForegroundWindow() -> isize;
        fn GetWindowThreadProcessId(hWnd: isize, lpdwProcessId: *mut u32) -> u32;
    }

    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn GetCurrentProcessId() -> u32;
    }

    const MAPVK_VSC_TO_VK_EX: u32 = 3;

    #[inline]
    fn is_vk_down(vk: i32) -> bool {
        if vk <= 0 {
            return false;
        }
        let state = unsafe { GetAsyncKeyState(vk) };
        (state as u16 & 0x8000) != 0
    }

    #[inline]
    pub fn is_vk_group_down(group: &[i32]) -> bool {
        group.iter().any(|&vk| is_vk_down(vk))
    }

    #[inline]
    pub fn is_own_process_foreground() -> bool {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd == 0 {
                return false;
            }
            let mut fg_pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, &mut fg_pid);
            fg_pid != 0 && fg_pid == GetCurrentProcessId()
        }
    }

    fn scancode_to_vk(scancode: u32, fallback_vk: i32) -> i32 {
        let mapped = unsafe { MapVirtualKeyW(scancode, MAPVK_VSC_TO_VK_EX) };
        if mapped != 0 {
            mapped as i32
        } else {
            fallback_vk
        }
    }

    pub fn resolve_token_vks(token: &str) -> Option<Vec<i32>> {
        let trimmed = token.trim();
        if trimmed.is_empty() {
            return None;
        }

        match trimmed {
            "Control" => Some(vec![0xA2, 0xA3, 0x11]), // VK_LCONTROL, VK_RCONTROL, VK_CONTROL
            "Alt" => Some(vec![0xA4, 0xA5, 0x12]),     // VK_LMENU, VK_RMENU, VK_MENU
            "Shift" => Some(vec![0xA0, 0xA1, 0x10]),   // VK_LSHIFT, VK_RSHIFT, VK_SHIFT
            "Super" => Some(vec![0x5B, 0x5C]),         // VK_LWIN, VK_RWIN
            "Mouse3" => Some(vec![0x04]),              // VK_MBUTTON
            "Mouse4" => Some(vec![0x05]),              // VK_XBUTTON1
            "Mouse5" => Some(vec![0x06]),              // VK_XBUTTON2
            "Space" => Some(vec![0x20]),
            "Backspace" => Some(vec![0x08]),
            "Tab" => Some(vec![0x09]),
            "Enter" | "NumpadEnter" => Some(vec![0x0D]),
            "Pause" => Some(vec![0x13]),
            "CapsLock" => Some(vec![0x14]),
            "PageUp" => Some(vec![0x21]),
            "PageDown" => Some(vec![0x22]),
            "End" => Some(vec![0x23]),
            "Home" => Some(vec![0x24]),
            "ArrowLeft" => Some(vec![0x25]),
            "ArrowUp" => Some(vec![0x26]),
            "ArrowRight" => Some(vec![0x27]),
            "ArrowDown" => Some(vec![0x28]),
            "PrintScreen" => Some(vec![0x2C]),
            "Insert" => Some(vec![0x2D]),
            "Delete" => Some(vec![0x2E]),
            "NumLock" => Some(vec![0x90]),
            "ScrollLock" => Some(vec![0x91]),
            "NumpadMultiply" => Some(vec![0x6A]),
            "NumpadAdd" => Some(vec![0x6B]),
            "NumpadSubtract" => Some(vec![0x6D]),
            "NumpadDecimal" => Some(vec![0x6E]),
            "NumpadDivide" => Some(vec![0x6F]),
            // Layout-independent physical scancodes matching Chromium KeyboardEvent.code
            "Backquote" => Some(vec![scancode_to_vk(0x29, 0xC0)]),
            "Minus" => Some(vec![scancode_to_vk(0x0C, 0xBD)]),
            "Equal" => Some(vec![scancode_to_vk(0x0D, 0xBB)]),
            "BracketLeft" => Some(vec![scancode_to_vk(0x1A, 0xDB)]),
            "BracketRight" => Some(vec![scancode_to_vk(0x1B, 0xDD)]),
            "Semicolon" => Some(vec![scancode_to_vk(0x27, 0xBA)]),
            "Quote" => Some(vec![scancode_to_vk(0x28, 0xDE)]),
            "Backslash" => Some(vec![scancode_to_vk(0x2B, 0xDC)]),
            "Comma" => Some(vec![scancode_to_vk(0x33, 0xBC)]),
            "Period" => Some(vec![scancode_to_vk(0x34, 0xBE)]),
            "Slash" => Some(vec![scancode_to_vk(0x35, 0xBF)]),
            "IntlBackslash" => Some(vec![scancode_to_vk(0x56, 0xE2)]),
            _ => {
                let bytes = trimmed.as_bytes();
                if bytes.len() == 1 {
                    let b = bytes[0];
                    if b.is_ascii_uppercase() || b.is_ascii_digit() {
                        return Some(vec![b as i32]);
                    }
                    if b.is_ascii_lowercase() {
                        return Some(vec![b.to_ascii_uppercase() as i32]);
                    }
                }
                if let Some(rest) = trimmed.strip_prefix("Numpad") {
                    if rest.len() == 1 {
                        let d = rest.as_bytes()[0];
                        if d.is_ascii_digit() {
                            return Some(vec![0x60 + (d - b'0') as i32]);
                        }
                    }
                }
                if let Some(rest) = trimmed.strip_prefix('F') {
                    if let Ok(num) = rest.parse::<i32>() {
                        if (1..=24).contains(&num) {
                            return Some(vec![0x70 + (num - 1)]);
                        }
                    }
                }
                None
            }
        }
    }

    pub fn parse_shortcut_vks(shortcut_key: &str) -> Option<Vec<Vec<i32>>> {
        let mut groups = Vec::new();
        for part in shortcut_key.split('+') {
            let group = resolve_token_vks(part)?;
            groups.push(group);
        }
        if groups.is_empty() {
            None
        } else {
            Some(groups)
        }
    }

    pub fn spawn_listener(
        app: AppHandle,
        controller: &PttController,
        shortcut_key: &str,
        generation: u64,
    ) -> Result<bool, String> {
        let Some(key_groups) = parse_shortcut_vks(shortcut_key) else {
            return Ok(false);
        };

        let mut guard = controller
            .session
            .lock()
            .map_err(|_| "Failed to acquire PTT controller lock".to_string())?;
        PttController::stop_locked(&mut guard);

        let stop = Arc::new(AtomicBool::new(false));
        let stop_flag = Arc::clone(&stop);

        let handle = thread::Builder::new()
            .name("voys-ptt-poll".to_string())
            .spawn(move || {
                let mut last_pressed = false;

                while !stop_flag.load(Ordering::SeqCst) {
                    let is_down = key_groups.iter().all(|g| is_vk_group_down(g));
                    if is_down != last_pressed {
                        last_pressed = is_down;
                        let payload = PttStatePayload {
                            pressed: is_down,
                            generation,
                            is_foreground_self: is_own_process_foreground(),
                            ctrl_down: is_vk_group_down(&[0xA2, 0xA3, 0x11]),
                            alt_down: is_vk_group_down(&[0xA4, 0xA5, 0x12]),
                            meta_down: is_vk_group_down(&[0x5B, 0x5C]),
                        };
                        let _ = app.emit("voys://ptt-state", payload);
                    }

                    if stop_flag.load(Ordering::SeqCst) {
                        break;
                    }
                    thread::park_timeout(Duration::from_millis(16));
                }
            })
            .map_err(|e| format!("Failed to spawn PTT listener thread: {}", e))?;

        *guard = Some(PttSession {
            stop,
            handle: Some(handle),
        });

        Ok(true)
    }
}

pub fn start_ptt_listener(
    app: AppHandle,
    controller: &PttController,
    shortcut_key: String,
    generation: Option<u64>,
) -> Result<bool, String> {
    let resolved_gen = generation
        .unwrap_or_else(|| controller.generation.fetch_add(1, Ordering::SeqCst) + 1);

    #[cfg(target_os = "windows")]
    {
        return win::spawn_listener(app, controller, &shortcut_key, resolved_gen);
    }

    #[cfg(not(target_os = "windows"))]
    {
        controller.stop();
        let _ = (app, shortcut_key, resolved_gen);
        Ok(false)
    }
}

pub fn stop_ptt_listener(controller: &PttController) {
    controller.stop();
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::win::parse_shortcut_vks;

    #[test]
    fn resolves_common_ptt_shortcuts() {
        assert_eq!(parse_shortcut_vks("Alt"), Some(vec![vec![0xA4, 0xA5, 0x12]]));
        assert_eq!(parse_shortcut_vks("Shift"), Some(vec![vec![0xA0, 0xA1, 0x10]]));
        assert_eq!(parse_shortcut_vks("Control"), Some(vec![vec![0xA2, 0xA3, 0x11]]));
        assert_eq!(parse_shortcut_vks("Mouse3"), Some(vec![vec![0x04]]));
        assert_eq!(parse_shortcut_vks("Mouse4"), Some(vec![vec![0x05]]));
        assert_eq!(parse_shortcut_vks("Mouse5"), Some(vec![vec![0x06]]));
        assert_eq!(parse_shortcut_vks("CapsLock"), Some(vec![vec![0x14]]));
        assert_eq!(parse_shortcut_vks("V"), Some(vec![vec![0x56]]));
        assert_eq!(
            parse_shortcut_vks("Alt+V"),
            Some(vec![vec![0xA4, 0xA5, 0x12], vec![0x56]])
        );
        assert_eq!(
            parse_shortcut_vks("Control+Space"),
            Some(vec![vec![0xA2, 0xA3, 0x11], vec![0x20]])
        );
        assert_eq!(parse_shortcut_vks("F4"), Some(vec![vec![0x73]]));
        assert!(parse_shortcut_vks("Backquote").is_some());
        assert!(parse_shortcut_vks("IntlBackslash").is_some());
        assert!(parse_shortcut_vks("").is_none());
    }
}

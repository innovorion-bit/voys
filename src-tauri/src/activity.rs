#[cfg(target_os = "windows")]
pub fn detect_running_game() -> Option<String> {
    use std::collections::HashSet;

    #[repr(C)]
    #[allow(non_snake_case)]
    struct PROCESSENTRY32W {
        dwSize: u32,
        cntUsage: u32,
        th32ProcessID: u32,
        th32DefaultHeapID: usize,
        th32ModuleID: u32,
        cntThreads: u32,
        th32ParentProcessID: u32,
        pcPriClassBase: i32,
        dwFlags: u32,
        szExeFile: [u16; 260],
    }

    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn CreateToolhelp32Snapshot(dwFlags: u32, th32ProcessID: u32) -> isize;
        fn Process32FirstW(hSnapshot: isize, lppe: *mut PROCESSENTRY32W) -> i32;
        fn Process32NextW(hSnapshot: isize, lppe: *mut PROCESSENTRY32W) -> i32;
        fn CloseHandle(hObject: isize) -> i32;
    }

    #[link(name = "user32")]
    unsafe extern "system" {
        fn GetForegroundWindow() -> isize;
        fn GetWindowTextW(hWnd: isize, lpString: *mut u16, nMaxCount: i32) -> i32;
    }

    let mut running_processes = HashSet::new();

    unsafe {
        let handle = CreateToolhelp32Snapshot(0x00000002, 0); // TH32CS_SNAPPROCESS
        if handle != -1 && handle != 0 {
            let mut entry = PROCESSENTRY32W {
                dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
                cntUsage: 0,
                th32ProcessID: 0,
                th32DefaultHeapID: 0,
                th32ModuleID: 0,
                cntThreads: 0,
                th32ParentProcessID: 0,
                pcPriClassBase: 0,
                dwFlags: 0,
                szExeFile: [0u16; 260],
            };

            if Process32FirstW(handle, &mut entry) != 0 {
                loop {
                    let len = entry.szExeFile.iter().position(|&c| c == 0).unwrap_or(entry.szExeFile.len());
                    let name = String::from_utf16_lossy(&entry.szExeFile[..len]).to_lowercase();
                    running_processes.insert(name);

                    if Process32NextW(handle, &mut entry) == 0 {
                        break;
                    }
                }
            }

            CloseHandle(handle);
        }
    }

    // 1. Check Active Window Title first
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd != 0 {
            let mut buf = [0u16; 512];
            let len = GetWindowTextW(hwnd, buf.as_mut_ptr(), 512);
            if len > 0 {
                let title = String::from_utf16_lossy(&buf[..len as usize]).to_lowercase();
                if title.contains("minecraft") {
                    return Some("Minecraft".to_string());
                }
                if title.contains("counter-strike 2") || title.contains("counter-strike") {
                    return Some("Counter-Strike 2".to_string());
                }
                if title.contains("valorant") {
                    return Some("VALORANT".to_string());
                }
                if title.contains("league of legends") {
                    return Some("League of Legends".to_string());
                }
                if title.contains("grand theft auto") || title.contains("gta v") {
                    return Some("Grand Theft Auto V".to_string());
                }
                if title.contains("apex legends") {
                    return Some("Apex Legends".to_string());
                }
                if title.contains("cyberpunk 2077") {
                    return Some("Cyberpunk 2077".to_string());
                }
                if title.contains("elden ring") {
                    return Some("ELDEN RING".to_string());
                }
            }
        }
    }

    // 2. Comprehensive Game Process Lookup Table (ordered by priority)
    let games = [
        ("cs2.exe", "Counter-Strike 2"),
        ("csgo.exe", "Counter-Strike: Global Offensive"),
        ("valorant-win64-shipping.exe", "VALORANT"),
        ("valorant.exe", "VALORANT"),
        ("leagueclientux.exe", "League of Legends"),
        ("league of legends.exe", "League of Legends"),
        ("dota2.exe", "Dota 2"),
        ("gta5.exe", "Grand Theft Auto V"),
        ("playgtav.exe", "Grand Theft Auto V"),
        ("r5apex.exe", "Apex Legends"),
        ("fortniteclient-win64-shipping.exe", "Fortnite"),
        ("fortnite.exe", "Fortnite"),
        ("overwatch.exe", "Overwatch 2"),
        ("rainbowsix.exe", "Rainbow Six Siege"),
        ("rainbowsix_vulkan.exe", "Rainbow Six Siege"),
        ("tslgame.exe", "PUBG: BATTLEGROUNDS"),
        ("robloxplayerbeta.exe", "Roblox"),
        ("deadbydaylight-win64-shipping.exe", "Dead by Daylight"),
        ("helldivers2.exe", "HELLDIVERS™ 2"),
        ("marvelrivals.exe", "Marvel Rivals"),
        ("cyberpunk2077.exe", "Cyberpunk 2077"),
        ("witcher3.exe", "The Witcher 3: Wild Hunt"),
        ("eldenring.exe", "ELDEN RING"),
        ("bg3.exe", "Baldur's Gate 3"),
        ("bg3_dx11.exe", "Baldur's Gate 3"),
        ("genshinimpact.exe", "Genshin Impact"),
        ("honkaistarrail.exe", "Honkai: Star Rail"),
        ("zenlesszonezero.exe", "Zenless Zone Zero"),
        ("tarkov.exe", "Escape from Tarkov"),
        ("escapefromtarkov.exe", "Escape from Tarkov"),
        ("rustclient.exe", "Rust"),
        ("palworld-win64-shipping.exe", "Palworld"),
        ("rocketleague.exe", "Rocket League"),
        ("brawlhalla.exe", "Brawlhalla"),
        ("fallguys_client.exe", "Fall Guys"),
        ("seaofthieves.exe", "Sea of Thieves"),
        ("eurotrucks2.exe", "Euro Truck Simulator 2"),
        ("worldoftanks.exe", "World of Tanks"),
        ("destiny2.exe", "Destiny 2"),
        ("warframe.x64.exe", "Warframe"),
        ("left4dead2.exe", "Left 4 Dead 2"),
        ("hl2.exe", "Team Fortress 2"),
        ("terraria.exe", "Terraria"),
        ("stardew valley.exe", "Stardew Valley"),
        ("among us.exe", "Among Us"),
        ("lethal company.exe", "Lethal Company"),
        ("fc25.exe", "EA SPORTS FC 25"),
        ("fc24.exe", "EA SPORTS FC 24"),
        ("fifa23.exe", "EA SPORTS FIFA"),
        ("footballmanager.exe", "Football Manager"),
        ("subnautica.exe", "Subnautica"),
        // Productivity / Development Tools
        ("code.exe", "Visual Studio Code"),
        ("spotify.exe", "Spotify"),
        ("devenv.exe", "Visual Studio"),
        ("blender.exe", "Blender"),
        ("photoshop.exe", "Adobe Photoshop"),
        ("premiere.exe", "Adobe Premiere Pro"),
        ("afterfx.exe", "Adobe After Effects"),
        ("fl64.exe", "FL Studio"),
        ("ableton live 11 suite.exe", "Ableton Live"),
        ("ableton live 12 suite.exe", "Ableton Live"),
        ("unrealeditor.exe", "Unreal Engine"),
        ("unity.exe", "Unity Editor"),
    ];

    for &(exe, name) in &games {
        if running_processes.contains(exe) {
            return Some(name.to_string());
        }
    }

    None
}

#[cfg(not(target_os = "windows"))]
pub fn detect_running_game() -> Option<String> {
    None
}

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

    // 1. Fast path: Check Active Foreground Window Title first (zero process snapshot overhead when gaming)
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
                if title.contains("roblox") {
                    return Some("Roblox".to_string());
                }
                if title.contains("dota 2") {
                    return Some("Dota 2".to_string());
                }
                if title.contains("fortnite") {
                    return Some("Fortnite".to_string());
                }
                if title.contains("pubg") {
                    return Some("PUBG: BATTLEGROUNDS".to_string());
                }
                if title.contains("rocket league") {
                    return Some("Rocket League".to_string());
                }
                if title.contains("rainbow six") {
                    return Some("Rainbow Six Siege".to_string());
                }
                if title.contains("red dead redemption") {
                    return Some("Red Dead Redemption 2".to_string());
                }
            }
        }
    }

    // 2. Fallback: Enumerate running processes only when foreground window title didn't match a game
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

    // Comprehensive Game Process Lookup Table (ordered by priority)
    let games = [
        ("cs2.exe", "Counter-Strike 2"),
        ("csgo.exe", "Counter-Strike: Global Offensive"),
        ("valorant-win64-shipping.exe", "VALORANT"),
        ("valorant.exe", "VALORANT"),
        ("leagueclientux.exe", "League of Legends"),
        ("leagueclient.exe", "League of Legends"),
        ("league of legends.exe", "League of Legends"),
        ("dota2.exe", "Dota 2"),
        ("gta5.exe", "Grand Theft Auto V"),
        ("playgtav.exe", "Grand Theft Auto V"),
        ("r5apex.exe", "Apex Legends"),
        ("apex.exe", "Apex Legends"),
        ("fortniteclient-win64-shipping.exe", "Fortnite"),
        ("fortnite.exe", "Fortnite"),
        ("overwatch.exe", "Overwatch 2"),
        ("rainbowsix.exe", "Rainbow Six Siege"),
        ("rainbowsix_vulkan.exe", "Rainbow Six Siege"),
        ("tslgame.exe", "PUBG: BATTLEGROUNDS"),
        ("robloxplayerbeta.exe", "Roblox"),
        ("robloxplayer.exe", "Roblox"),
        ("javaw.exe", "Minecraft"),
        ("minecraft.exe", "Minecraft"),
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
        ("rust.exe", "Rust"),
        ("palworld-win64-shipping.exe", "Palworld"),
        ("palworld.exe", "Palworld"),
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
        ("fifa22.exe", "EA SPORTS FIFA"),
        ("footballmanager.exe", "Football Manager"),
        ("subnautica.exe", "Subnautica"),
        ("rdr2.exe", "Red Dead Redemption 2"),
        ("playrdr2.exe", "Red Dead Redemption 2"),
        ("sekiro.exe", "Sekiro: Shadows Die Twice"),
        ("darksoulsiii.exe", "Dark Souls III"),
        ("forzahorizon5.exe", "Forza Horizon 5"),
        ("forzahorizon4.exe", "Forza Horizon 4"),
        ("beamng.drive.x64.exe", "BeamNG.drive"),
        ("payday3.exe", "PAYDAY 3"),
        ("payday2_win32_release.exe", "PAYDAY 2"),
        ("shootergame.exe", "ARK: Survival Evolved"),
        ("sonsoftheforest.exe", "Sons of the Forest"),
        ("theforest.exe", "The Forest"),
        ("hollow_knight.exe", "Hollow Knight"),
        ("hades.exe", "Hades"),
        ("hades2.exe", "Hades II"),
        ("bannerlord.exe", "Mount & Blade II: Bannerlord"),
        ("metin2client.exe", "Metin2"),
        ("knightonline.exe", "Knight Online"),
        ("zula.exe", "Zula"),
        ("wolftü.exe", "Wolfteam"),
        ("pointblank.exe", "Point Blank"),
        ("cod.exe", "Call of Duty"),
        ("callofduty.exe", "Call of Duty"),
        ("warthunder.exe", "War Thunder"),
        ("pathofexile.exe", "Path of Exile"),
        ("pathofexile_x64.exe", "Path of Exile"),
        ("diablo iv.exe", "Diablo IV"),
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

fn main() {
  println!("cargo:rerun-if-changed=icons/icon.ico");
  let icon_path = std::env::current_dir()
    .expect("failed to get current dir")
    .join("icons")
    .join("icon.ico");

  let attributes = tauri_build::Attributes::new().windows_attributes(
    tauri_build::WindowsAttributes::new().window_icon_path(icon_path),
  );
  tauri_build::try_build(attributes).expect("failed to run tauri-build");
}

use tauri::Emitter;

#[cfg(target_os = "macos")]
use objc2::rc::Retained;
#[cfg(target_os = "macos")]
use objc2::runtime::ProtocolObject;
#[cfg(target_os = "macos")]
use objc2::{define_class, msg_send, AnyThread, DefinedClass, MainThreadOnly};
#[cfg(target_os = "macos")]
use objc2_app_kit::{
  NSDragOperation, NSDraggingContext, NSDraggingItem, NSDraggingSession, NSDraggingSource,
  NSEventType, NSPasteboardItem, NSPasteboardTypeHTML, NSPasteboardTypeString, NSView, NSWindow,
  NSWorkspace,
};
#[cfg(target_os = "macos")]
use objc2_foundation::{NSArray, NSObject, NSObjectProtocol, NSPoint, NSRect, NSSize, NSString};

#[cfg(target_os = "macos")]
struct DragSourceIvars {
  window: tauri::Window,
  session_id: String,
}

#[cfg(target_os = "macos")]
define_class!(
  #[unsafe(super = NSObject)]
  #[thread_kind = MainThreadOnly]
  #[ivars = DragSourceIvars]
  struct DragSource;

  unsafe impl NSObjectProtocol for DragSource {}

  unsafe impl NSDraggingSource for DragSource {
    #[unsafe(method(draggingSession:sourceOperationMaskForDraggingContext:))]
    fn dragging_session_source_operation_mask_for_dragging_context(
      &self,
      _session: &NSDraggingSession,
      _context: NSDraggingContext,
    ) -> NSDragOperation {
      NSDragOperation::Copy
    }

    #[unsafe(method(draggingSession:endedAtPoint:operation:))]
    fn dragging_session_ended_at_point_operation(
      &self,
      _session: &NSDraggingSession,
      _screen_point: NSPoint,
      operation: NSDragOperation,
    ) {
      let operation_name = if operation == NSDragOperation::None {
        "none"
      } else if operation.contains(NSDragOperation::Copy) {
        "copy"
      } else {
        "other"
      };
      let _ = self.ivars().window.emit(
        "drawio-drag-ended",
        serde_json::json!({
          "sessionId": self.ivars().session_id,
          "operation": operation_name,
        }),
      );
    }
  }
);

#[cfg(target_os = "macos")]
impl DragSource {
  fn new(
    mtm: objc2::MainThreadMarker,
    window: tauri::Window,
    session_id: String,
  ) -> Retained<Self> {
    let this = mtm.alloc().set_ivars(DragSourceIvars { window, session_id });
    unsafe { msg_send![super(this), init] }
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![begin_drawio_insert_drag, fetch_plantuml_svg])
    .menu(build_menu)
    .on_menu_event(|app, event| {
      let command = match event.id().as_ref() {
        "open" => "open",
        "save-source" => "save-source",
        "save-drawio" => "save-drawio",
        "export-svg" => "export-svg",
        "export-png" => "export-png",
        "settings" => "settings",
        "toggle-syntax-help" => "toggle-syntax-help",
        "toggle-theme" => "toggle-theme",
        "open-github" => "open-github",
        _ => return,
      };

      if let Err(error) = app.emit("desktop-menu-command", command) {
        log::warn!("failed to emit desktop menu command: {error}");
      }
    })
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[tauri::command]
async fn fetch_plantuml_svg(url: String) -> Result<String, String> {
  const MAX_SVG_BYTES: u64 = 5 * 1024 * 1024;
  let parsed_url = reqwest::Url::parse(&url).map_err(|_| "PlantUML renderer URL was invalid.".to_string())?;
  if parsed_url.scheme() != "https" || !parsed_url.path().contains("/svg/") {
    return Err("PlantUML renderer must be an HTTPS SVG endpoint.".into());
  }

  let client = reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(12))
    .redirect(reqwest::redirect::Policy::limited(2))
    .user_agent("Syntax2DrawIO/0.1")
    .build()
    .map_err(|error| error.to_string())?;
  let response = client
    .get(parsed_url)
    .send()
    .await
    .map_err(|error| error.to_string())?;

  if !response.status().is_success() {
    return Err(format!("PlantUML renderer returned {}.", response.status()));
  }

  if response.content_length().unwrap_or(0) > MAX_SVG_BYTES {
    return Err("PlantUML renderer response exceeded the 5 MB safety limit.".into());
  }
  let bytes = response.bytes().await.map_err(|error| error.to_string())?;
  if bytes.len() as u64 > MAX_SVG_BYTES {
    return Err("PlantUML renderer response exceeded the 5 MB safety limit.".into());
  }
  let svg = String::from_utf8(bytes.to_vec()).map_err(|error| error.to_string())?;
  let normalized = svg.trim_start();
  if !normalized.starts_with("<svg") && !normalized.starts_with("<?xml") {
    return Err("PlantUML renderer did not return valid SVG markup.".into());
  }
  if normalized.contains("<script") || normalized.contains("javascript:") {
    return Err("PlantUML renderer returned unsafe SVG markup.".into());
  }

  Ok(svg)
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn begin_drawio_insert_drag(
  window: tauri::Window,
  graph_model_xml: String,
  html_fragment: String,
  suggested_name: String,
  session_id: String,
) -> Result<(), String> {
  let window_for_drag = window.clone();
  let (tx, rx) = std::sync::mpsc::channel();

  window
    .run_on_main_thread(move || {
      let result = unsafe {
        start_drag_session(
          &window_for_drag,
          &graph_model_xml,
          &html_fragment,
          &suggested_name,
          &session_id,
        )
      };
      let _ = tx.send(result);
    })
    .map_err(|error| error.to_string())?;

  rx.recv()
    .map_err(|_| "Failed to receive drag session result from the main thread.".to_string())?
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn begin_drawio_insert_drag(
  _window: tauri::Window,
  _graph_model_xml: String,
  _html_fragment: String,
  _suggested_name: String,
  _session_id: String,
) -> Result<(), String> {
  Err("Editable draw.io canvas drag is only available on macOS desktop builds.".into())
}

#[cfg(target_os = "macos")]
unsafe fn start_drag_session(
  window: &tauri::Window,
  graph_model_xml: &str,
  html_fragment: &str,
  suggested_name: &str,
  session_id: &str,
) -> Result<(), String> {
  if !graph_model_xml.contains("<mxGraphModel") || !graph_model_xml.contains("<mxCell") {
    return Err("draw.io drag session could not start: editable graph payload was empty.".into());
  }

  let ns_view_ptr = window.ns_view().map_err(|error| error.to_string())?;
  let ns_window_ptr = window.ns_window().map_err(|error| error.to_string())?;
  let ns_view = &*(ns_view_ptr as *mut NSView);
  let ns_window = &*(ns_window_ptr as *mut NSWindow);

  let event = ns_window
    .currentEvent()
    .ok_or_else(|| "draw.io drag session could not start: drag must begin from a toolbar pointer interaction.".to_string())?;

  let event_type = event.r#type();
  if event_type != NSEventType::LeftMouseDown
    && event_type != NSEventType::LeftMouseDragged
    && event_type != NSEventType::LeftMouseUp
    && event_type != NSEventType::OtherMouseDown
    && event_type != NSEventType::OtherMouseDragged
    && event_type != NSEventType::RightMouseDown
    && event_type != NSEventType::RightMouseDragged
  {
    return Err("draw.io drag session could not start: unsupported pointer event for drag handoff.".into());
  }

  let graph_model = NSString::from_str(graph_model_xml);
  let pasteboard_item = NSPasteboardItem::new();
  let xml_type = NSString::from_str("public.xml");
  let drawio_type = NSString::from_str("com.jgraph.mxfile");
  pasteboard_item.setString_forType(&graph_model, NSPasteboardTypeString);
  pasteboard_item.setString_forType(&NSString::from_str(html_fragment), NSPasteboardTypeHTML);
  pasteboard_item.setString_forType(&graph_model, &xml_type);
  pasteboard_item.setString_forType(&graph_model, &drawio_type);

  let dragging_item = NSDraggingItem::initWithPasteboardWriter(
    NSDraggingItem::alloc(),
    ProtocolObject::from_ref(&*pasteboard_item),
  );

  let workspace = NSWorkspace::sharedWorkspace();
  let file_type = NSString::from_str("drawio");
  let drag_icon = workspace.iconForFileType(&file_type);
  let drag_point = ns_view.convertPoint_fromView(event.locationInWindow(), None);
  let drag_frame = NSRect::new(
    NSPoint::new(drag_point.x - 24.0, drag_point.y - 24.0),
    NSSize::new(48.0, 48.0),
  );
  dragging_item.setDraggingFrame_contents(drag_frame, Some(drag_icon.as_ref()));

  let items = NSArray::from_retained_slice(&[dragging_item]);
  let source = DragSource::new(ns_view.mtm(), window.clone(), session_id.to_string());
  ns_view.beginDraggingSessionWithItems_event_source(&items, &event, ProtocolObject::from_ref(&*source));

  log::info!("started editable draw.io insert drag for {suggested_name}");
  Ok(())
}

fn build_menu(
  app: &tauri::AppHandle,
) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
  use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};

  let about = AboutMetadata {
    name: Some("Syntax2DrawIO".into()),
    version: Some(env!("CARGO_PKG_VERSION").into()),
    copyright: Some("Copyright © 2026 Syntax2DrawIO".into()),
    ..Default::default()
  };

  let app_menu = Submenu::with_items(
    app,
    "Syntax2DrawIO",
    true,
    &[
      &PredefinedMenuItem::about(app, Some("About Syntax2DrawIO"), Some(about))?,
      &PredefinedMenuItem::separator(app)?,
      &MenuItem::with_id(app, "settings", "Settings...", true, Some("CmdOrCtrl+,"))?,
      &PredefinedMenuItem::separator(app)?,
      &PredefinedMenuItem::services(app, None)?,
      &PredefinedMenuItem::separator(app)?,
      &PredefinedMenuItem::hide(app, None)?,
      &PredefinedMenuItem::hide_others(app, None)?,
      &PredefinedMenuItem::show_all(app, None)?,
      &PredefinedMenuItem::separator(app)?,
      &PredefinedMenuItem::quit(app, None)?,
    ],
  )?;

  let file_menu = Submenu::with_items(
    app,
    "File",
    true,
    &[
      &MenuItem::with_id(app, "open", "Open...", true, Some("CmdOrCtrl+O"))?,
      &MenuItem::with_id(app, "save-source", "Save Source...", true, Some("CmdOrCtrl+S"))?,
      &PredefinedMenuItem::separator(app)?,
      &MenuItem::with_id(app, "save-drawio", "Export .drawio...", true, Some("CmdOrCtrl+E"))?,
      &MenuItem::with_id(app, "export-svg", "Export SVG...", true, Some("CmdOrCtrl+Shift+S"))?,
      &MenuItem::with_id(app, "export-png", "Export PNG...", true, Some("CmdOrCtrl+Shift+P"))?,
      &PredefinedMenuItem::separator(app)?,
      &PredefinedMenuItem::close_window(app, None)?,
    ],
  )?;

  let edit_menu = Submenu::with_items(
    app,
    "Edit",
    true,
    &[
      &PredefinedMenuItem::undo(app, None)?,
      &PredefinedMenuItem::redo(app, None)?,
      &PredefinedMenuItem::separator(app)?,
      &PredefinedMenuItem::cut(app, None)?,
      &PredefinedMenuItem::copy(app, None)?,
      &PredefinedMenuItem::paste(app, None)?,
      &PredefinedMenuItem::select_all(app, None)?,
    ],
  )?;

  let view_menu = Submenu::with_items(
    app,
    "View",
    true,
    &[
      &MenuItem::with_id(
        app,
        "toggle-syntax-help",
        "Toggle Syntax Help",
        true,
        Some("CmdOrCtrl+/"),
      )?,
      &MenuItem::with_id(app, "toggle-theme", "Toggle Theme", true, Some("CmdOrCtrl+Shift+L"))?,
      &PredefinedMenuItem::separator(app)?,
      &PredefinedMenuItem::fullscreen(app, None)?,
    ],
  )?;

  let help_menu = Submenu::with_items(
    app,
    "Help",
    true,
    &[&MenuItem::with_id(
      app,
      "open-github",
      "GitHub Repository",
      true,
      None::<&str>,
    )?],
  )?;

  Menu::with_items(
    app,
    &[&app_menu, &file_menu, &edit_menu, &view_menu, &help_menu],
  )
}

use tauri::{AppHandle, Manager, State};
use std::path::PathBuf;
use matrix_sdk::Client;
use crate::matrix::client_manager::ClientManager;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct MatrixError {
    message: String,
}

impl From<matrix_sdk::Error> for MatrixError {
    fn from(err: matrix_sdk::Error) -> Self {
        Self {
            message: err.to_string(),
        }
    }
}

impl From<url::ParseError> for MatrixError {
    fn from(err: url::ParseError) -> Self {
        Self {
            message: err.to_string(),
        }
    }
}

impl From<matrix_sdk::ClientBuildError> for MatrixError {
    fn from(err: matrix_sdk::ClientBuildError) -> Self {
        Self {
            message: err.to_string(),
        }
    }
}

impl From<matrix_sdk::ruma::IdParseError> for MatrixError {
    fn from(err: matrix_sdk::ruma::IdParseError) -> Self {
        Self {
            message: err.to_string(),
        }
    }
}

fn get_storage_path(app: &AppHandle, account_id: &str) -> Result<PathBuf, MatrixError> {
    let mut path = app.path().app_local_data_dir().map_err(|e| MatrixError { message: e.to_string() })?;
    path.push("matrix_sessions");
    path.push(account_id);
    Ok(path)
}

fn get_or_create_passphrase(account_id: &str) -> Result<String, MatrixError> {
    use keyring::Entry;
    use rand::RngExt;

    let entry = Entry::new("OmniMatrix", account_id).map_err(|e| MatrixError {
        message: format!("Keyring error: {}", e),
    })?;

    match entry.get_password() {
        Ok(password) => Ok(password),
        Err(keyring::Error::NoEntry) => {
            let password: String = rand::rng()
                .sample_iter(&rand::distr::Alphanumeric)
                .take(32)
                .map(char::from)
                .collect();
            entry.set_password(&password).map_err(|e| MatrixError {
                message: format!("Failed to set keyring password: {}", e),
            })?;
            Ok(password)
        }
        Err(e) => Err(MatrixError {
            message: format!("Keyring error: {}", e),
        }),
    }
}

#[tauri::command]
pub async fn login(
    app: AppHandle,
    state: State<'_, ClientManager>,
    account_id: String,
    homeserver: String,
    username: String,
    password: String,
) -> Result<(), MatrixError> {
    let path = get_storage_path(&app, &account_id)?;
    
    // If the user logs in anew, they get a new Device ID from the homeserver.
    // The crypto store is strictly tied to a single Device ID.
    // We MUST clear the old store to prevent "account in store doesn't match" errors.
    if path.exists() {
        let _ = std::fs::remove_dir_all(&path);
    }
    std::fs::create_dir_all(&path).map_err(|e| MatrixError { message: e.to_string() })?;

    let passphrase = get_or_create_passphrase(&account_id)?;

    // Create a new client
    let client = Client::builder()
        .homeserver_url(homeserver)
        .sqlite_store(&path, Some(&passphrase))
        .build()
        .await
        .map_err(|e| MatrixError { message: e.to_string() })?;

    client.matrix_auth().login_username(&username, &password).send().await.map_err(|e| MatrixError { message: e.to_string() })?;

    // Save to manager
    state.add_client(account_id, client).await;

    Ok(())
}

#[tauri::command]
pub async fn register(
    app: AppHandle,
    state: State<'_, ClientManager>,
    account_id: String,
    homeserver: String,
    username: String,
    password: String,
) -> Result<(), MatrixError> {
    let path = get_storage_path(&app, &account_id)?;
    
    // Clear old store for the same reason
    if path.exists() {
        let _ = std::fs::remove_dir_all(&path);
    }
    std::fs::create_dir_all(&path).map_err(|e| MatrixError { message: e.to_string() })?;

    let passphrase = get_or_create_passphrase(&account_id)?;

    let client = Client::builder()
        .homeserver_url(homeserver)
        .sqlite_store(&path, Some(&passphrase))
        .build()
        .await
        .map_err(|e| MatrixError { message: e.to_string() })?;

    let mut request = matrix_sdk::ruma::api::client::account::register::v3::Request::new();
    request.username = Some(username.clone());
    request.password = Some(password.clone());

    client.matrix_auth().register(request).await.map_err(|e| MatrixError { message: e.to_string() })?;

    // Registration usually doesn't automatically log in depending on homeserver configuration.
    // We try to login after registration to be sure we have a session.
    if !client.matrix_auth().logged_in() {
        let _ = client.matrix_auth().login_username(&username, &password).send().await;
    }

    state.add_client(account_id, client).await;

    Ok(())
}

#[tauri::command]
pub async fn login_sso(
    app: AppHandle,
    state: State<'_, ClientManager>,
    account_id: String,
    homeserver: String,
    login_token: String,
) -> Result<(), MatrixError> {
    let path = get_storage_path(&app, &account_id)?;
    
    // Clear old store
    if path.exists() {
        let _ = std::fs::remove_dir_all(&path);
    }
    std::fs::create_dir_all(&path).map_err(|e| MatrixError { message: e.to_string() })?;

    let passphrase = get_or_create_passphrase(&account_id)?;

    let client = Client::builder()
        .homeserver_url(homeserver)
        .sqlite_store(&path, Some(&passphrase))
        .build()
        .await
        .map_err(|e| MatrixError { message: e.to_string() })?;

    client.matrix_auth().login_token(&login_token).send().await.map_err(|e| MatrixError { message: e.to_string() })?;

    state.add_client(account_id, client).await;

    Ok(())
}

#[tauri::command]
pub async fn restore_session(
    app: AppHandle,
    state: State<'_, ClientManager>,
    account_id: String,
    homeserver: String,
) -> Result<bool, MatrixError> {
    let path = get_storage_path(&app, &account_id)?;

    if !path.exists() {
        return Ok(false);
    }

    let passphrase = get_or_create_passphrase(&account_id)?;

    let client = Client::builder()
        .homeserver_url(homeserver)
        .sqlite_store(&path, Some(&passphrase))
        .build()
        .await?;

    if client.matrix_auth().logged_in() {
        state.add_client(account_id, client).await;
        Ok(true)
    } else {
        Ok(false)
    }
}

use tauri::Emitter;

#[derive(Clone, Serialize)]
pub struct NewMessagePayload {
    pub account_id: String,
    pub room_id: String,
    pub sender: String,
    pub body: String,
}

#[derive(Clone, Serialize)]
pub struct MatrixRoomPayload {
    pub id: String,
    pub name: String,
    pub avatar: Option<String>,
    #[serde(rename = "lastMessage")]
    pub last_message: String,
    pub unread: u32,
    #[serde(rename = "isDm")]
    pub is_dm: bool,
    #[serde(rename = "isEncrypted")]
    pub is_encrypted: bool,
    #[serde(rename = "isSpace")]
    pub is_space: bool,
    #[serde(rename = "parentSpaces")]
    pub parent_spaces: Vec<String>,
}

#[derive(Clone, Serialize)]
pub struct InitialRoomsPayload {
    pub account_id: String,
    pub rooms: Vec<MatrixRoomPayload>,
}

#[tauri::command]
pub async fn logout(
    app: AppHandle,
    state: State<'_, ClientManager>,
    account_id: String,
) -> Result<(), MatrixError> {
    // 1. Get client and log out from the server
    if let Some(client) = state.get_client(&account_id).await {
        let _ = client.matrix_auth().logout().await;
        state.remove_client(&account_id).await;
    }

    // 2. Clear local storage
    let path = get_storage_path(&app, &account_id)?;
    if path.exists() {
        let _ = std::fs::remove_dir_all(&path);
    }

    Ok(())
}
use futures_util::StreamExt;
#[tauri::command]
pub async fn sync(app: AppHandle, state: State<'_, ClientManager>, account_id: String) -> Result<(), MatrixError> {
    let client = state.get_client(&account_id).await.ok_or_else(|| MatrixError {
        message: "Account not found or not logged in".to_string(),
    })?;

    let app_handle = app.clone();
    let account_id_clone = account_id.clone();
    client.add_event_handler(move |ev: matrix_sdk::ruma::events::room::message::OriginalSyncRoomMessageEvent, room: matrix_sdk::Room| {
        let app_handle = app_handle.clone();
        let account_id_clone = account_id_clone.clone();
        async move {
            let body = match &ev.content.msgtype {
                matrix_sdk::ruma::events::room::message::MessageType::Text(t) => t.body.clone(),
                _ => "A non-text message".to_string(),
            };

            let payload = NewMessagePayload {
                account_id: account_id_clone,
                room_id: room.room_id().to_string(),
                sender: ev.sender.to_string(),
                body,
            };

            let _ = app_handle.emit("matrix-new-message", payload);
        }
    });

    // Perform initial sync to fetch rooms
    let sync_settings = matrix_sdk::config::SyncSettings::default();
    let initial_response = client.sync_once(sync_settings.clone()).await?;

    // Fetch existing rooms
    let mut initial_rooms = Vec::new();
    for room in client.rooms() {
        let display_name = room.display_name().await.unwrap_or(matrix_sdk::RoomDisplayName::Empty);
        let name = display_name.to_string();
        let is_dm = room.is_direct().await.unwrap_or(false);
        // matrix-sdk 0.18 uses latest_encryption_state
        let is_encrypted = room.latest_encryption_state().await.map(|s| s.is_encrypted()).unwrap_or(false);
        let is_space = room.is_space();
        
        let avatar = match room.avatar_url() {
            Some(url) => Some(url.to_string()),
            None => {
                if is_dm {
                    room.heroes().first().and_then(|h| h.avatar_url.as_ref().map(|url| url.to_string()))
                } else {
                    None
                }
            }
        };
        
        let mut parent_spaces = Vec::new();
        if let Ok(mut stream) = room.parent_spaces().await {
            while let Some(Ok(parent)) = stream.next().await {
                match parent {
                    matrix_sdk::room::ParentSpace::Reciprocal(r) => parent_spaces.push(r.room_id().to_string()),
                    matrix_sdk::room::ParentSpace::WithPowerlevel(r) => parent_spaces.push(r.room_id().to_string()),
                    matrix_sdk::room::ParentSpace::Illegitimate(r) => parent_spaces.push(r.room_id().to_string()),
                    matrix_sdk::room::ParentSpace::Unverifiable(id) => parent_spaces.push(id.to_string()),
                }
            }
        }

        initial_rooms.push(MatrixRoomPayload {
            id: room.room_id().to_string(),
            name,
            avatar,
            last_message: "".to_string(),
            unread: 0,
            is_dm,
            is_encrypted,
            is_space,
            parent_spaces,
        });
    }

    let _ = app.emit("matrix-initial-rooms", InitialRoomsPayload {
        account_id: account_id.clone(),
        rooms: initial_rooms,
    });

    // Start sync in background
    let next_batch = initial_response.next_batch;
    tokio::spawn(async move {
        let mut sync_settings = matrix_sdk::config::SyncSettings::default();
        sync_settings = sync_settings.token(next_batch);
        
        if let Err(e) = client.sync(sync_settings).await {
            eprintln!("Sync error: {}", e);
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn send_message(
    state: State<'_, ClientManager>,
    account_id: String,
    room_id: String,
    content: String,
) -> Result<(), MatrixError> {
    let client = state.get_client(&account_id).await.ok_or_else(|| MatrixError {
        message: "Account not found or not logged in".to_string(),
    })?;

    let room_id = matrix_sdk::ruma::RoomId::parse(&room_id)?;
    let room = client.get_room(&room_id).ok_or_else(|| MatrixError {
        message: "Room not found".to_string(),
    })?;

    let content = matrix_sdk::ruma::events::room::message::RoomMessageEventContent::text_plain(content);
    
    room.send(content).await?;

    Ok(())
}

#[tauri::command]
pub async fn send_media(
    state: State<'_, ClientManager>,
    account_id: String,
    room_id: String,
    file_bytes: Vec<u8>,
    mime_type: String,
    file_name: String,
) -> Result<(), MatrixError> {
    let client = state.get_client(&account_id).await.ok_or_else(|| MatrixError {
        message: "Account not found or not logged in".to_string(),
    })?;
    let room_id = matrix_sdk::ruma::RoomId::parse(&room_id).map_err(|e| MatrixError { message: e.to_string() })?;
    let room = client.get_room(&room_id).ok_or_else(|| MatrixError {
        message: "Room not found".to_string(),
    })?;

    let mime: mime::Mime = mime_type.parse().map_err(|e| MatrixError { message: format!("Invalid mime: {}", e) })?;
    
    room.send_attachment(&file_name, &mime, file_bytes, matrix_sdk::attachment::AttachmentConfig::new())
        .await
        .map_err(|e| MatrixError { message: e.to_string() })?;

    Ok(())
}

#[tauri::command]
pub async fn recover_backup(
    state: State<'_, ClientManager>,
    account_id: String,
    passphrase: String,
) -> Result<(), MatrixError> {
    let client = state.get_client(&account_id).await.ok_or_else(|| MatrixError {
        message: "Account not found or not logged in".to_string(),
    })?;
    
    client.encryption().recovery().recover(&passphrase).await.map_err(|e| MatrixError { message: e.to_string() })?;
    Ok(())
}

#[tauri::command]
pub async fn send_typing_notice(
    state: State<'_, ClientManager>,
    account_id: String,
    room_id: String,
    is_typing: bool,
) -> Result<(), MatrixError> {
    let client = state.get_client(&account_id).await.ok_or_else(|| MatrixError {
        message: "Account not found or not logged in".to_string(),
    })?;
    let room_id = matrix_sdk::ruma::RoomId::parse(&room_id).map_err(|e| MatrixError { message: e.to_string() })?;
    let room = client.get_room(&room_id).ok_or_else(|| MatrixError {
        message: "Room not found".to_string(),
    })?;
    
    room.typing_notice(is_typing).await.map_err(|e| MatrixError { message: e.to_string() })?;
    Ok(())
}

#[tauri::command]
pub async fn send_read_receipt(
    state: State<'_, ClientManager>,
    account_id: String,
    room_id: String,
    event_id: String,
) -> Result<(), MatrixError> {
    let client = state.get_client(&account_id).await.ok_or_else(|| MatrixError {
        message: "Account not found or not logged in".to_string(),
    })?;
    let room_id = matrix_sdk::ruma::RoomId::parse(&room_id).map_err(|e| MatrixError { message: e.to_string() })?;
    let event_id = matrix_sdk::ruma::EventId::parse(&event_id).map_err(|e| MatrixError { message: e.to_string() })?;
    let room = client.get_room(&room_id).ok_or_else(|| MatrixError {
        message: "Room not found".to_string(),
    })?;
    
    let receipt_type = matrix_sdk::ruma::api::client::receipt::create_receipt::v3::ReceiptType::Read;
    let thread = matrix_sdk::ruma::events::receipt::ReceiptThread::Unthreaded;
    room.send_single_receipt(receipt_type, thread, event_id).await.map_err(|e| MatrixError { message: e.to_string() })?;
    
    Ok(())
}

#[tauri::command]
pub async fn send_call_invite(
    state: State<'_, ClientManager>,
    account_id: String,
    room_id: String,
    call_type: String,
) -> Result<(), MatrixError> {
    let _client = state.get_client(&account_id).await.ok_or_else(|| MatrixError {
        message: "Account not found or not logged in".to_string(),
    })?;

    // Stub for sending a call invite
    println!("Sending {} call invite to room {} via account {}", call_type, room_id, account_id);

    Ok(())
}

#[tauri::command]
pub async fn get_media(
    state: State<'_, ClientManager>,
    account_id: String,
    mxc_uri: String,
) -> Result<Vec<u8>, MatrixError> {
    let client = state.get_client(&account_id).await.ok_or_else(|| MatrixError {
        message: "Account not found or not logged in".to_string(),
    })?;

    let uri = <&matrix_sdk::ruma::MxcUri>::try_from(mxc_uri.as_str()).map_err(|e| MatrixError {
        message: format!("Invalid MXC URI: {}", e),
    })?.to_owned();

    let request = matrix_sdk::media::MediaRequestParameters {
        source: matrix_sdk::ruma::events::room::MediaSource::Plain(uri),
        format: matrix_sdk::media::MediaFormat::File,
    };

    let bytes = client.media().get_media_content(&request, true).await.map_err(|e| MatrixError {
        message: format!("Failed to get media: {}", e),
    })?;

    Ok(bytes)
}

#[derive(Clone, Serialize)]
pub struct UserProfilePayload {
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    #[serde(rename = "avatarUrl")]
    pub avatar_url: Option<String>,
}

#[tauri::command]
pub async fn get_profile(
    state: State<'_, ClientManager>,
    account_id: String,
) -> Result<UserProfilePayload, MatrixError> {
    let client = state.get_client(&account_id).await.ok_or_else(|| MatrixError {
        message: "Account not found or not logged in".to_string(),
    })?;

    let account = client.account();
    let display_name = account.get_display_name().await.unwrap_or(None);
    let avatar_url = account.get_avatar_url().await.unwrap_or(None).map(|uri| uri.to_string());

    Ok(UserProfilePayload {
        display_name,
        avatar_url,
    })
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelineMessagePayload {
    pub id: String,
    pub sender: String,
    pub body: String,
    pub is_mine: bool,
    pub timestamp: u64,
    pub msg_type: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoomHistoryPayload {
    pub messages: Vec<TimelineMessagePayload>,
    pub end_token: Option<String>,
    pub has_more: bool,
}

fn extract_event_content(event: &matrix_sdk::deserialized_responses::TimelineEvent, own_user_id: Option<String>) -> Option<TimelineMessagePayload> {
    use matrix_sdk::ruma::events::AnySyncTimelineEvent;
    use matrix_sdk::ruma::events::room::message::MessageType as RumaMessageType;
    
    let raw = event.raw();
    let any_event: AnySyncTimelineEvent = raw.deserialize().ok()?;
    
    match any_event {
        AnySyncTimelineEvent::MessageLike(msg) => {
            match msg {
                matrix_sdk::ruma::events::AnySyncMessageLikeEvent::RoomMessage(room_msg) => {
                    // Handle Original and Redacted events separately
                    match room_msg {
                        matrix_sdk::ruma::events::SyncMessageLikeEvent::Original(orig) => {
                            let sender = orig.sender.to_string();
                            let event_id = orig.event_id.to_string();
                            let is_mine = Some(&sender) == own_user_id.as_ref();
                            
                            // Extract content based on message type
                            let (body, msg_type) = match &orig.content.msgtype {
                                RumaMessageType::Text(text) => (text.body.clone(), "text".to_string()),
                                RumaMessageType::Image(img) => {
                                    let caption = if img.body.is_empty() { "[Image]" } else { &img.body };
                                    (caption.to_string(), "image".to_string())
                                },
                                RumaMessageType::Video(vid) => {
                                    let caption = if vid.body.is_empty() { "[Video]" } else { &vid.body };
                                    (caption.to_string(), "video".to_string())
                                },
                                RumaMessageType::File(file) => {
                                    let caption = if file.filename.as_deref().unwrap_or("").is_empty() { "[File]" } else { file.filename.as_deref().unwrap_or("") };
                                    (caption.to_string(), "file".to_string())
                                },
                                RumaMessageType::Audio(audio) => {
                                    let caption = if audio.body.is_empty() { "[Audio]" } else { &audio.body };
                                    (caption.to_string(), "audio".to_string())
                                },
                                _ => ("[Unknown message type]".to_string(), "unknown".to_string()),
                            };
                            
                            let timestamp = event.timestamp()
                                .map(|ts| u64::from(ts.0))
                                .unwrap_or(0);
                            
                            Some(TimelineMessagePayload {
                                id: event_id,
                                sender,
                                body,
                                is_mine,
                                timestamp,
                                msg_type,
                            })
                        },
                        matrix_sdk::ruma::events::SyncMessageLikeEvent::Redacted(_) => None,
                    }
                },
                _ => None,
            }
        },
        _ => None,
    }
}

#[tauri::command]
pub async fn fetch_room_messages(
    state: State<'_, ClientManager>,
    account_id: String,
    room_id: String,
    from: Option<String>,
    limit: u16,
) -> Result<RoomHistoryPayload, MatrixError> {
    let client = state.get_client(&account_id).await.ok_or_else(|| MatrixError {
        message: "Account not found or not logged in".to_string(),
    })?;
    
    let room_id_parsed = matrix_sdk::ruma::RoomId::parse(&room_id).map_err(|e| MatrixError {
        message: format!("Invalid room ID: {}", e),
    })?;
    
    let room = client.get_room(&room_id_parsed).ok_or_else(|| MatrixError {
        message: "Room not found".to_string(),
    })?;
    
    let mut opts = matrix_sdk::room::MessagesOptions::backward();
    opts.limit = (limit as u32).into();
    if let Some(token) = from {
        opts.from = Some(token);
    }
    
    let messages = room.messages(opts).await.map_err(|e| MatrixError {
        message: format!("Failed to fetch messages: {}", e),
    })?;
    
    let own_user_id = client.user_id().map(|u| u.to_string());
    let mut result_messages = Vec::new();
    
    for event in messages.chunk {
        if let Some(msg) = extract_event_content(&event, own_user_id.clone()) {
            result_messages.push(msg);
        }
    }
    
    let end_token = messages.end;
    let has_more = end_token.is_some();
    
    Ok(RoomHistoryPayload {
        messages: result_messages,
        end_token,
        has_more,
    })
}

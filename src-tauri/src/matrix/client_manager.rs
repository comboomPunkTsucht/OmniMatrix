use matrix_sdk::Client;
use matrix_sdk::room::timeline::Timeline;
use std::collections::HashMap;
use tokio::sync::RwLock;

pub struct ClientManager {
    pub clients: RwLock<HashMap<String, Client>>,
    /// Caches timelines per (account_id, room_id) to avoid re-creation
    pub timelines_cache: RwLock<HashMap<String, Timeline>>,
}

impl ClientManager {
    pub fn new() -> Self {
        Self {
            clients: RwLock::new(HashMap::new()),
            timeline_cache: RwLock::new(HashMap::new()),
        }
    }

    pub async fn get_client(&self, account_id: &str) -> Option<Client> {
        self.clients.read().await.get(account_id).cloned()
    }

    pub async fn add_client(&self, account_id: String, client: Client) {
        self.clients.write().await.insert(account_id, client);
    }

    pub async fn remove_client(&self, account_id: &str) {
        self.clients.write().await.remove(account_id);
    }

    fn timeline_key(account_id: &str, room_id: &str) -> String {
        format!("{account_id}:{room_id}")
    }

    pub async fn get_timeline(&self, account_id: &str, room_id: &str) -> Option<Timeline> {
        let key = Self::timeline_key(account_id, room_id);
        self.timeline_cache.read().await.get(&key).cloned()
    }

    pub async fn set_timeline(&self, account_id: &str, room_id: &str, timeline: Timeline) {
        let key = Self::timeline_key(account_id, room_id);
        self.timeline_cache.write().await.insert(key, timeline);
    }

    pub async fn clear_account_timelines(&self, account_id: &str) {
        let mut cache = self.timeline_cache.write().await;
        let prefix = format!("{account_id}:");
        cache.retain(|k, _| !k.starts_with(&prefix));
    }
}

impl Default for ClientManager {
    fn default() -> Self {
        Self::new()
    }
}

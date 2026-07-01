use matrix_sdk::Client;
use std::collections::HashMap;
use tokio::sync::RwLock;

pub struct ClientManager {
    pub clients: RwLock<HashMap<String, Client>>,
}

impl ClientManager {
    pub fn new() -> Self {
        Self {
            clients: RwLock::new(HashMap::new()),
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
}

impl Default for ClientManager {
    fn default() -> Self {
        Self::new()
    }
}
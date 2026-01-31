"""
Cloud Sync Service - SMB und SharePoint Integration
====================================================
Ermöglicht das automatische Hochladen von generierten Dokumenten
auf Netzlaufwerke (SMB) oder SharePoint/OneDrive.

Unterstützte Provider:
- LOCAL: Lokales Dateisystem (Standard/Fallback)
- SMB: Windows-Netzlaufwerke über SMB-Protokoll
- SHAREPOINT: Microsoft 365 SharePoint/OneDrive über Graph API
"""

from abc import ABC, abstractmethod
from typing import List, Optional
import os
import shutil
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


class StorageProvider(ABC):
    """Abstrakte Basisklasse für Storage Provider."""

    @abstractmethod
    def upload_file(self, local_path: str, remote_path: str) -> bool:
        """
        Lädt eine lokale Datei auf den Remote-Speicher hoch.

        Args:
            local_path: Pfad zur lokalen Datei
            remote_path: Zielpfad auf dem Remote-Speicher

        Returns:
            True bei Erfolg, False bei Fehler
        """
        pass

    @abstractmethod
    def download_file(self, remote_path: str, local_path: str) -> bool:
        """
        Lädt eine Datei vom Remote-Speicher herunter.

        Args:
            remote_path: Pfad auf dem Remote-Speicher
            local_path: Lokaler Zielpfad

        Returns:
            True bei Erfolg, False bei Fehler
        """
        pass

    @abstractmethod
    def list_files(self, remote_path: str) -> List[str]:
        """
        Listet Dateien in einem Remote-Verzeichnis auf.

        Args:
            remote_path: Pfad zum Verzeichnis

        Returns:
            Liste der Dateinamen
        """
        pass

    @abstractmethod
    def delete_file(self, remote_path: str) -> bool:
        """
        Löscht eine Datei vom Remote-Speicher.

        Args:
            remote_path: Pfad zur Datei

        Returns:
            True bei Erfolg, False bei Fehler
        """
        pass

    @abstractmethod
    def file_exists(self, remote_path: str) -> bool:
        """
        Prüft ob eine Datei existiert.

        Args:
            remote_path: Pfad zur Datei

        Returns:
            True wenn Datei existiert
        """
        pass


class LocalProvider(StorageProvider):
    """
    Lokaler Dateisystem-Provider (Standard/Fallback).

    Speichert Dateien im lokalen Dateisystem.
    Nützlich für Entwicklung und als Fallback.
    """

    def __init__(self, root_dir: str):
        self.root_dir = Path(root_dir)
        self.root_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"LocalProvider initialized with root: {self.root_dir}")

    def _get_full_path(self, remote_path: str) -> Path:
        """Erstellt den vollständigen lokalen Pfad."""
        return self.root_dir / remote_path.lstrip("/")

    def upload_file(self, local_path: str, remote_path: str) -> bool:
        try:
            dest = self._get_full_path(remote_path)
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(local_path, dest)
            logger.info(f"LocalProvider: Uploaded {local_path} -> {dest}")
            return True
        except Exception as e:
            logger.error(f"LocalProvider upload failed: {e}")
            return False

    def download_file(self, remote_path: str, local_path: str) -> bool:
        try:
            source = self._get_full_path(remote_path)
            if not source.exists():
                logger.error(f"LocalProvider: Source file not found: {source}")
                return False
            Path(local_path).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, local_path)
            logger.info(f"LocalProvider: Downloaded {source} -> {local_path}")
            return True
        except Exception as e:
            logger.error(f"LocalProvider download failed: {e}")
            return False

    def list_files(self, remote_path: str) -> List[str]:
        try:
            target = self._get_full_path(remote_path)
            if not target.exists():
                return []
            return [f.name for f in target.iterdir() if f.is_file()]
        except Exception as e:
            logger.error(f"LocalProvider list_files failed: {e}")
            return []

    def delete_file(self, remote_path: str) -> bool:
        try:
            target = self._get_full_path(remote_path)
            if target.exists():
                target.unlink()
                logger.info(f"LocalProvider: Deleted {target}")
                return True
            return False
        except Exception as e:
            logger.error(f"LocalProvider delete failed: {e}")
            return False

    def file_exists(self, remote_path: str) -> bool:
        return self._get_full_path(remote_path).exists()


class SMBProvider(StorageProvider):
    """
    SMB/CIFS Provider für Windows-Netzlaufwerke.

    Verwendet smbprotocol für direkte SMB-Kommunikation.
    Unterstützt SMB 2.x und SMB 3.x mit Verschlüsselung.

    Konfiguration:
        server: Hostname oder IP des SMB-Servers
        share: Name der Freigabe (z.B. "dokumente$")
        username: Benutzername (Format: DOMAIN\\user oder user@domain)
        password: Passwort
        port: SMB-Port (Standard: 445)
        encrypt: Verschlüsselung aktivieren (Standard: True für SMB 3.0+)
    """

    def __init__(self, config: dict):
        self.server = config.get("server")
        self.share = config.get("share")
        self.username = config.get("username")
        self.password = config.get("password")
        self.port = config.get("port", 445)
        self.encrypt = config.get("encrypt", True)
        self._connection = None
        self._session = None
        self._tree = None

        if not all([self.server, self.share]):
            raise ValueError("SMBProvider requires 'server' and 'share' in config")

        logger.info(f"SMBProvider initialized for \\\\{self.server}\\{self.share}")

    def _connect(self):
        """Stellt die SMB-Verbindung her (lazy initialization)."""
        if self._tree is not None:
            return

        try:
            from smbprotocol.connection import Connection
            from smbprotocol.session import Session
            from smbprotocol.tree import TreeConnect

            # Verbindung herstellen
            self._connection = Connection(uuid=None, server=self.server, port=self.port)
            self._connection.connect()

            # Session aufbauen
            self._session = Session(
                self._connection,
                username=self.username,
                password=self.password,
                require_encryption=self.encrypt
            )
            self._session.connect()

            # Tree-Connect zur Freigabe
            share_path = f"\\\\{self.server}\\{self.share}"
            self._tree = TreeConnect(self._session, share_path)
            self._tree.connect()

            logger.info(f"SMBProvider: Connected to {share_path}")

        except ImportError:
            raise ImportError(
                "smbprotocol ist nicht installiert. "
                "Bitte installieren Sie es mit: pip install smbprotocol"
            )
        except Exception as e:
            logger.error(f"SMBProvider connection failed: {e}")
            raise ConnectionError(f"SMB-Verbindung fehlgeschlagen: {e}")

    def _disconnect(self):
        """Trennt die SMB-Verbindung."""
        try:
            if self._tree:
                self._tree.disconnect()
            if self._session:
                self._session.disconnect()
            if self._connection:
                self._connection.disconnect()
        except Exception as e:
            logger.warning(f"SMBProvider disconnect warning: {e}")
        finally:
            self._tree = None
            self._session = None
            self._connection = None

    def upload_file(self, local_path: str, remote_path: str) -> bool:
        try:
            from smbprotocol.open import Open, CreateDisposition, FileAttributes, ShareAccess, ImpersonationLevel
            from smbprotocol.open import FilePipePrinterAccessMask

            self._connect()

            # Remote-Pfad normalisieren
            remote_path = remote_path.replace("/", "\\").lstrip("\\")

            # Verzeichnisse erstellen falls nötig
            self._ensure_remote_directory(os.path.dirname(remote_path))

            # Datei öffnen/erstellen
            file_open = Open(self._tree, remote_path)
            file_open.create(
                impersonation_level=ImpersonationLevel.Impersonation,
                desired_access=FilePipePrinterAccessMask.GENERIC_WRITE | FilePipePrinterAccessMask.DELETE,
                file_attributes=FileAttributes.FILE_ATTRIBUTE_NORMAL,
                share_access=ShareAccess.FILE_SHARE_READ,
                create_disposition=CreateDisposition.FILE_OVERWRITE_IF,
            )

            # Datei hochladen
            with open(local_path, "rb") as f:
                content = f.read()
                file_open.write(content, 0)

            file_open.close()

            logger.info(f"SMBProvider: Uploaded {local_path} -> \\\\{self.server}\\{self.share}\\{remote_path}")
            return True

        except Exception as e:
            logger.error(f"SMBProvider upload failed: {e}")
            return False

    def _ensure_remote_directory(self, remote_dir: str):
        """Erstellt Remote-Verzeichnisse rekursiv."""
        if not remote_dir:
            return

        from smbprotocol.open import Open, CreateDisposition, FileAttributes, ShareAccess, ImpersonationLevel
        from smbprotocol.open import DirectoryAccessMask

        parts = remote_dir.replace("/", "\\").strip("\\").split("\\")
        current_path = ""

        for part in parts:
            if not part:
                continue
            current_path = f"{current_path}\\{part}" if current_path else part

            try:
                dir_open = Open(self._tree, current_path)
                dir_open.create(
                    impersonation_level=ImpersonationLevel.Impersonation,
                    desired_access=DirectoryAccessMask.FILE_LIST_DIRECTORY,
                    file_attributes=FileAttributes.FILE_ATTRIBUTE_DIRECTORY,
                    share_access=ShareAccess.FILE_SHARE_READ | ShareAccess.FILE_SHARE_WRITE,
                    create_disposition=CreateDisposition.FILE_OPEN_IF,
                    create_options=0x00000001,  # FILE_DIRECTORY_FILE
                )
                dir_open.close()
            except Exception:
                pass  # Verzeichnis existiert möglicherweise bereits

    def download_file(self, remote_path: str, local_path: str) -> bool:
        try:
            from smbprotocol.open import Open, CreateDisposition, FileAttributes, ShareAccess, ImpersonationLevel
            from smbprotocol.open import FilePipePrinterAccessMask

            self._connect()

            remote_path = remote_path.replace("/", "\\").lstrip("\\")

            file_open = Open(self._tree, remote_path)
            file_open.create(
                impersonation_level=ImpersonationLevel.Impersonation,
                desired_access=FilePipePrinterAccessMask.GENERIC_READ,
                file_attributes=FileAttributes.FILE_ATTRIBUTE_NORMAL,
                share_access=ShareAccess.FILE_SHARE_READ,
                create_disposition=CreateDisposition.FILE_OPEN,
            )

            # Dateigröße ermitteln
            file_info = file_open.query_info()
            file_size = file_info.fields['end_of_file'].get_value()

            # Datei lesen
            content = file_open.read(0, file_size)
            file_open.close()

            # Lokal speichern
            Path(local_path).parent.mkdir(parents=True, exist_ok=True)
            with open(local_path, "wb") as f:
                f.write(content)

            logger.info(f"SMBProvider: Downloaded \\\\{self.server}\\{self.share}\\{remote_path} -> {local_path}")
            return True

        except Exception as e:
            logger.error(f"SMBProvider download failed: {e}")
            return False

    def list_files(self, remote_path: str) -> List[str]:
        try:
            from smbprotocol.open import Open, CreateDisposition, FileAttributes, ShareAccess, ImpersonationLevel
            from smbprotocol.open import DirectoryAccessMask

            self._connect()

            remote_path = remote_path.replace("/", "\\").lstrip("\\") or "."

            dir_open = Open(self._tree, remote_path)
            dir_open.create(
                impersonation_level=ImpersonationLevel.Impersonation,
                desired_access=DirectoryAccessMask.FILE_LIST_DIRECTORY,
                file_attributes=FileAttributes.FILE_ATTRIBUTE_DIRECTORY,
                share_access=ShareAccess.FILE_SHARE_READ,
                create_disposition=CreateDisposition.FILE_OPEN,
                create_options=0x00000001,  # FILE_DIRECTORY_FILE
            )

            files = []
            for entry in dir_open.query_directory("*"):
                name = entry['file_name'].get_value()
                if name not in [".", ".."]:
                    files.append(name)

            dir_open.close()
            return files

        except Exception as e:
            logger.error(f"SMBProvider list_files failed: {e}")
            return []

    def delete_file(self, remote_path: str) -> bool:
        try:
            from smbprotocol.open import Open, CreateDisposition, FileAttributes, ShareAccess, ImpersonationLevel
            from smbprotocol.open import FilePipePrinterAccessMask

            self._connect()

            remote_path = remote_path.replace("/", "\\").lstrip("\\")

            file_open = Open(self._tree, remote_path)
            file_open.create(
                impersonation_level=ImpersonationLevel.Impersonation,
                desired_access=FilePipePrinterAccessMask.DELETE,
                file_attributes=FileAttributes.FILE_ATTRIBUTE_NORMAL,
                share_access=ShareAccess.FILE_SHARE_DELETE,
                create_disposition=CreateDisposition.FILE_OPEN,
            )

            file_open.delete()
            file_open.close()

            logger.info(f"SMBProvider: Deleted \\\\{self.server}\\{self.share}\\{remote_path}")
            return True

        except Exception as e:
            logger.error(f"SMBProvider delete failed: {e}")
            return False

    def file_exists(self, remote_path: str) -> bool:
        try:
            from smbprotocol.open import Open, CreateDisposition, FileAttributes, ShareAccess, ImpersonationLevel
            from smbprotocol.open import FilePipePrinterAccessMask

            self._connect()

            remote_path = remote_path.replace("/", "\\").lstrip("\\")

            file_open = Open(self._tree, remote_path)
            file_open.create(
                impersonation_level=ImpersonationLevel.Impersonation,
                desired_access=FilePipePrinterAccessMask.FILE_READ_ATTRIBUTES,
                file_attributes=FileAttributes.FILE_ATTRIBUTE_NORMAL,
                share_access=ShareAccess.FILE_SHARE_READ,
                create_disposition=CreateDisposition.FILE_OPEN,
            )
            file_open.close()
            return True

        except Exception:
            return False


class SharePointProvider(StorageProvider):
    """
    SharePoint/OneDrive Provider über Microsoft Graph API.

    Verwendet die Microsoft Graph SDK für Zugriff auf SharePoint-Dokumentbibliotheken
    und OneDrive for Business.

    Konfiguration:
        tenant_id: Azure AD Tenant ID
        client_id: Azure AD App Registration Client ID
        client_secret: Azure AD App Registration Client Secret
        site_id: SharePoint Site ID (optional, für Site-spezifischen Zugriff)
        drive_id: Drive ID (optional, für spezifische Dokumentbibliothek)

    Authentifizierung:
        Verwendet Client Credentials Flow (App-only) für Server-zu-Server Zugriff.
        Benötigt folgende Graph API Permissions:
        - Files.ReadWrite.All (Application)
        - Sites.ReadWrite.All (Application) - falls site_id verwendet wird
    """

    def __init__(self, config: dict):
        self.tenant_id = config.get("tenant_id")
        self.client_id = config.get("client_id")
        self.client_secret = config.get("client_secret")
        self.site_id = config.get("site_id")
        self.drive_id = config.get("drive_id")
        self._client = None
        self._drive = None

        if not all([self.tenant_id, self.client_id, self.client_secret]):
            raise ValueError(
                "SharePointProvider requires 'tenant_id', 'client_id', and 'client_secret' in config"
            )

        logger.info(f"SharePointProvider initialized for tenant: {self.tenant_id}")

    def _get_client(self):
        """Initialisiert den Microsoft Graph Client (lazy initialization)."""
        if self._client is not None:
            return self._client

        try:
            from azure.identity import ClientSecretCredential
            from msgraph import GraphServiceClient

            # Credential erstellen
            credential = ClientSecretCredential(
                tenant_id=self.tenant_id,
                client_id=self.client_id,
                client_secret=self.client_secret
            )

            # Graph Client erstellen
            scopes = ["https://graph.microsoft.com/.default"]
            self._client = GraphServiceClient(credentials=credential, scopes=scopes)

            logger.info("SharePointProvider: Graph client initialized")
            return self._client

        except ImportError:
            raise ImportError(
                "azure-identity und/oder msgraph-sdk sind nicht installiert. "
                "Bitte installieren Sie sie mit: pip install azure-identity msgraph-sdk"
            )
        except Exception as e:
            logger.error(f"SharePointProvider client init failed: {e}")
            raise ConnectionError(f"Graph API Verbindung fehlgeschlagen: {e}")

    async def _get_drive(self):
        """Ermittelt das Drive-Objekt für Dateioperationen."""
        if self._drive is not None:
            return self._drive

        client = self._get_client()

        if self.drive_id:
            # Spezifisches Drive verwenden
            self._drive = client.drives.by_drive_id(self.drive_id)
        elif self.site_id:
            # Default Drive der SharePoint Site
            self._drive = client.sites.by_site_id(self.site_id).drive
        else:
            # User's OneDrive (nur mit delegierten Berechtigungen)
            # Für App-only: Default Site Drive verwenden
            root_site = await client.sites.get_by_path("root").get()
            self._drive = client.sites.by_site_id(root_site.id).drive

        return self._drive

    def upload_file(self, local_path: str, remote_path: str) -> bool:
        """
        Lädt eine Datei nach SharePoint/OneDrive hoch.

        Verwendet für kleine Dateien (<4MB) den einfachen Upload,
        für größere Dateien den Upload-Session-Mechanismus.
        """
        import asyncio

        async def _upload():
            try:
                drive = await self._get_drive()

                # Remote-Pfad normalisieren
                remote_path_normalized = remote_path.replace("\\", "/").strip("/")

                # Datei lesen
                with open(local_path, "rb") as f:
                    content = f.read()

                file_size = len(content)

                if file_size < 4 * 1024 * 1024:  # < 4MB: Einfacher Upload
                    # PUT /drives/{drive-id}/items/root:/{path}:/content
                    await drive.items.by_drive_item_id(f"root:/{remote_path_normalized}:").content.put(content)
                else:
                    # Großer Upload mit Upload Session
                    from msgraph.generated.drives.item.items.item.create_upload_session.create_upload_session_post_request_body import CreateUploadSessionPostRequestBody
                    from msgraph.generated.models.drive_item_uploadable_properties import DriveItemUploadableProperties

                    upload_props = DriveItemUploadableProperties()
                    upload_props.name = os.path.basename(remote_path_normalized)

                    request_body = CreateUploadSessionPostRequestBody()
                    request_body.item = upload_props

                    # Upload Session erstellen
                    upload_session = await drive.items.by_drive_item_id(
                        f"root:/{remote_path_normalized}:"
                    ).create_upload_session.post(request_body)

                    # Datei in Chunks hochladen
                    chunk_size = 320 * 1024 * 10  # 3.2 MB chunks
                    offset = 0

                    import httpx
                    async with httpx.AsyncClient() as http_client:
                        while offset < file_size:
                            chunk_end = min(offset + chunk_size, file_size)
                            chunk = content[offset:chunk_end]

                            headers = {
                                "Content-Length": str(len(chunk)),
                                "Content-Range": f"bytes {offset}-{chunk_end - 1}/{file_size}"
                            }

                            await http_client.put(
                                upload_session.upload_url,
                                content=chunk,
                                headers=headers
                            )

                            offset = chunk_end

                logger.info(f"SharePointProvider: Uploaded {local_path} -> {remote_path_normalized}")
                return True

            except Exception as e:
                logger.error(f"SharePointProvider upload failed: {e}")
                return False

        # Async in sync Kontext ausführen
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        return loop.run_until_complete(_upload())

    def download_file(self, remote_path: str, local_path: str) -> bool:
        import asyncio

        async def _download():
            try:
                drive = await self._get_drive()
                remote_path_normalized = remote_path.replace("\\", "/").strip("/")

                # GET /drives/{drive-id}/items/root:/{path}:/content
                content = await drive.items.by_drive_item_id(
                    f"root:/{remote_path_normalized}:"
                ).content.get()

                # Lokal speichern
                Path(local_path).parent.mkdir(parents=True, exist_ok=True)
                with open(local_path, "wb") as f:
                    f.write(content)

                logger.info(f"SharePointProvider: Downloaded {remote_path_normalized} -> {local_path}")
                return True

            except Exception as e:
                logger.error(f"SharePointProvider download failed: {e}")
                return False

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        return loop.run_until_complete(_download())

    def list_files(self, remote_path: str) -> List[str]:
        import asyncio

        async def _list():
            try:
                drive = await self._get_drive()
                remote_path_normalized = remote_path.replace("\\", "/").strip("/") or "root"

                if remote_path_normalized == "root":
                    children = await drive.root.children.get()
                else:
                    children = await drive.items.by_drive_item_id(
                        f"root:/{remote_path_normalized}:"
                    ).children.get()

                files = []
                if children and children.value:
                    for item in children.value:
                        if not item.folder:  # Nur Dateien, keine Ordner
                            files.append(item.name)

                return files

            except Exception as e:
                logger.error(f"SharePointProvider list_files failed: {e}")
                return []

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        return loop.run_until_complete(_list())

    def delete_file(self, remote_path: str) -> bool:
        import asyncio

        async def _delete():
            try:
                drive = await self._get_drive()
                remote_path_normalized = remote_path.replace("\\", "/").strip("/")

                await drive.items.by_drive_item_id(
                    f"root:/{remote_path_normalized}:"
                ).delete()

                logger.info(f"SharePointProvider: Deleted {remote_path_normalized}")
                return True

            except Exception as e:
                logger.error(f"SharePointProvider delete failed: {e}")
                return False

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        return loop.run_until_complete(_delete())

    def file_exists(self, remote_path: str) -> bool:
        import asyncio

        async def _exists():
            try:
                drive = await self._get_drive()
                remote_path_normalized = remote_path.replace("\\", "/").strip("/")

                item = await drive.items.by_drive_item_id(
                    f"root:/{remote_path_normalized}:"
                ).get()

                return item is not None

            except Exception:
                return False

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        return loop.run_until_complete(_exists())


class CloudSyncFactory:
    """
    Factory für Storage Provider.

    Erstellt den passenden Provider basierend auf dem Typ.
    """

    PROVIDER_TYPES = {
        "LOCAL": LocalProvider,
        "SMB": SMBProvider,
        "SHAREPOINT": SharePointProvider,
    }

    @staticmethod
    def get_provider(provider_type: str, config: dict) -> StorageProvider:
        """
        Erstellt einen Storage Provider.

        Args:
            provider_type: "LOCAL", "SMB", oder "SHAREPOINT"
            config: Provider-spezifische Konfiguration

        Returns:
            StorageProvider-Instanz

        Raises:
            ValueError: Bei unbekanntem Provider-Typ
        """
        provider_type = provider_type.upper()

        if provider_type == "LOCAL":
            return LocalProvider(config.get("root_path", "/tmp/document_sync"))
        elif provider_type == "SMB":
            return SMBProvider(config)
        elif provider_type == "SHAREPOINT":
            return SharePointProvider(config)
        else:
            logger.warning(f"Unknown provider type: {provider_type}, falling back to LOCAL")
            return LocalProvider(config.get("root_path", "/tmp/document_sync"))

    @staticmethod
    def get_available_providers() -> List[str]:
        """Gibt Liste der verfügbaren Provider-Typen zurück."""
        return list(CloudSyncFactory.PROVIDER_TYPES.keys())


# Hilfsfunktionen für einfache Nutzung

def sync_document_to_cloud(
    local_path: str,
    remote_path: str,
    provider_type: str = "LOCAL",
    config: dict = None
) -> bool:
    """
    Einfache Hilfsfunktion zum Hochladen eines Dokuments.

    Args:
        local_path: Lokaler Dateipfad
        remote_path: Remote-Zielpfad
        provider_type: "LOCAL", "SMB", oder "SHAREPOINT"
        config: Provider-Konfiguration

    Returns:
        True bei Erfolg
    """
    config = config or {}
    provider = CloudSyncFactory.get_provider(provider_type, config)
    return provider.upload_file(local_path, remote_path)

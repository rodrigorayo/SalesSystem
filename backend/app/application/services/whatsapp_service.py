import httpx
import logging
from typing import Optional
from app.domain.models.tenant import WhatsAppSettings

logger = logging.getLogger(__name__)

class WhatsAppService:
    @staticmethod
    async def send_message(phone: str, message: str, settings: WhatsAppSettings, pdf_url: Optional[str] = None) -> bool:
        if not settings.enabled or not settings.instance_id or not settings.api_token:
            return False
            
        # Clean phone number (remove spaces, +, etc)
        clean_phone = "".join(filter(str.isdigit, phone))
        
        # Ensure it has country code (e.g., Bolivia 591)
        if len(clean_phone) == 8:
            clean_phone = f"591{clean_phone}"
            
        if settings.provider == "GREENAPI":
            return await WhatsAppService._send_greenapi(clean_phone, message, settings, pdf_url)
        elif settings.provider == "ULTRAMSG":
            return await WhatsAppService._send_ultramsg(clean_phone, message, settings, pdf_url)
            
        return False

    @staticmethod
    async def _send_greenapi(phone: str, message: str, settings: WhatsAppSettings, pdf_url: Optional[str] = None) -> bool:
        # Green API requires @c.us suffix
        chat_id = f"{phone}@c.us"
        
        # Base URL format: https://api.green-api.com/waInstance{InstanceId}/sendMessage/{Token}
        url_message = f"https://api.green-api.com/waInstance{settings.instance_id}/sendMessage/{settings.api_token}"
        url_file = f"https://api.green-api.com/waInstance{settings.instance_id}/sendFileByUrl/{settings.api_token}"
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # 1. Send the PDF if provided
                if pdf_url:
                    payload_file = {
                        "chatId": chat_id,
                        "urlFile": pdf_url,
                        "fileName": "Comprobante_Venta.pdf",
                        "caption": message
                    }
                    resp = await client.post(url_file, json=payload_file)
                    if resp.status_code == 200:
                        return True
                    else:
                        logger.error(f"GreenAPI Error sending file: {resp.text}")
                        # Fallback to normal message if file fails
                
                # 2. Send normal message
                payload_msg = {
                    "chatId": chat_id,
                    "message": message
                }
                resp = await client.post(url_message, json=payload_msg)
                return resp.status_code == 200
        except Exception as e:
            logger.error(f"WhatsApp Service Error: {str(e)}")
            return False

    @staticmethod
    async def _send_ultramsg(phone: str, message: str, settings: WhatsAppSettings, pdf_url: Optional[str] = None) -> bool:
        # UltraMsg uses instance ID in domain or path
        url_message = f"https://api.ultramsg.com/{settings.instance_id}/messages/chat"
        url_document = f"https://api.ultramsg.com/{settings.instance_id}/messages/document"
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                if pdf_url:
                    payload = {
                        "token": settings.api_token,
                        "to": phone,
                        "document": pdf_url,
                        "filename": "Comprobante_Venta.pdf",
                        "caption": message
                    }
                    resp = await client.post(url_document, data=payload)
                    if resp.status_code == 200:
                        return True
                
                payload = {
                    "token": settings.api_token,
                    "to": phone,
                    "body": message
                }
                resp = await client.post(url_message, data=payload)
                return resp.status_code == 200
        except Exception as e:
            logger.error(f"WhatsApp UltraMsg Error: {str(e)}")
            return False

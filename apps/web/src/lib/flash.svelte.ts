import { page } from "$app/state";
import { toast } from "svelte-sonner";

const flashMessageHandlers = {
  "already-registered": () => {
    toast.info("ลงทะเบียนแล้ว");
  },
  "please-register": () => {
    toast.info("กรุณาลงทะเบียนก่อน");
  },
  "please-login": () => {
    toast.info("กรุณาเข้าสู่ระบบก่อน");
  },
  "unknown-error": () => {
    toast.info("เกิดข้อผิดพลาดขึ้น");
  },
  "dont-rush": () => {
    toast.info("เกมไม่เปิดทีครับ");
  },
  "not-yet-start": () => toast.info("ไม่เปิดทีครับ"),
  "not-allowed": () => {
    toast.info("ไม่สามารถเล่นได้");
  },
  "unauthorized": () => {
    toast.error("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
  },
};

export type FlashMessageType = keyof typeof flashMessageHandlers;

export function flashParams(type: FlashMessageType) {
  return `flash=${type}`;
}

export function registerFlashConsumer() {
  const stop = $effect.root(() => {
    $effect(() => {
      const messageType = page.url.searchParams.get("flash");
      if (!messageType || !Object.keys(flashMessageHandlers).includes(messageType)) {
        // console.log(messageType)
        return;
      }
      flashMessageHandlers[messageType as FlashMessageType]();
    });
  });

  return stop;
}
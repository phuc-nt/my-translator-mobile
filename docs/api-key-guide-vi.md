# Hướng dẫn lấy API key (Tiếng Việt)

My Translator không có server riêng. Bạn tự tạo API key của Soniox hoặc OpenAI,
dán vào app, và app gửi âm thanh thẳng tới nhà cung cấp đó. Key được lưu trong
keychain bảo mật của máy, không gửi đi đâu khác.

Chỉ cần **một** trong hai key là dùng được.

| Nhà cung cấp | Giá tham khảo | Đầu ra | Gợi ý |
| --- | --- | --- | --- |
| **Soniox** | ~$0.12/giờ | Văn bản dịch trên màn hình | Rẻ, **nên dùng** |
| **OpenAI Realtime** | ~$4/giờ | Văn bản + giọng nói (mặc định tắt) | Khi cần đọc thành tiếng |

---

## 1. Soniox (khuyến nghị)

1. Mở <https://console.soniox.com> và đăng ký tài khoản (email hoặc Google).
2. Xác nhận email nếu được yêu cầu, rồi đăng nhập vào Console.
3. Vào mục **API Keys** ở menu bên trái.
4. Bấm **Create API key**, đặt tên bất kỳ (ví dụ: `my-translator`).
5. **Sao chép key ngay** — Soniox chỉ hiển thị đầy đủ một lần. Nếu mất phải tạo key mới.
6. Tài khoản mới thường có sẵn credit dùng thử miễn phí, đủ để test ngay.
7. Mở app My Translator → màn hình **Settings** → dán key vào ô **Soniox**.

> Để dùng lâu dài, vào mục **Billing** trong Console để nạp tiền hoặc gắn thẻ.
> Soniox tính theo thời lượng âm thanh thực tế (~$0.12/giờ), chỉ có văn bản.

---

## 2. OpenAI (khi cần giọng nói)

1. Mở <https://platform.openai.com/api-keys> và đăng nhập (hoặc tạo tài khoản).
2. Nếu là tài khoản mới: vào **Settings → Billing** và nạp tối thiểu một khoản
   tín dụng — OpenAI Realtime **không** dùng được nếu chưa có credit.
3. **Đặt hạn mức chi tiêu (quan trọng):** vào **Settings → Limits**, đặt
   *Monthly budget* ở mức thấp (ví dụ $5–$10) để tránh bị tính tiền ngoài ý muốn.
   Realtime ~$4/giờ nên rất dễ vượt nếu để quên.
4. Quay lại trang **API keys**, bấm **Create new secret key**, đặt tên
   (ví dụ: `my-translator`).
5. **Sao chép key ngay** — OpenAI chỉ hiển thị một lần duy nhất.
6. Mở app My Translator → màn hình **Settings** → dán key vào ô **OpenAI**.
7. Trên màn hình chính, bấm biểu tượng 🔇 ở thanh tiêu đề để bật giọng đọc
   (mặc định đang tắt tiếng).

---

## Lưu ý bảo mật

- Key giống như mật khẩu — **không chia sẻ, không chụp màn hình gửi cho ai**.
- Nếu lỡ để lộ: vào lại trang quản lý key của nhà cung cấp, **xoá (revoke)**
  key cũ và tạo key mới.
- App chỉ lưu key trong keychain của máy bạn. Gỡ app là key mất theo.
- Không có lịch sử bản dịch, không backend, không tracking. Xem [PRIVACY.md](../PRIVACY.md).

import { Resend } from "resend";

// Khởi tạo LƯỜI, không phải ở module scope: `new Resend()` throw ngay nếu
// thiếu API key, mà `next build` import route để thu thập metadata (không
// chạy request thật) — throw ở module scope sẽ sập toàn bộ build chỉ vì
// thiếu 1 biến môi trường không liên quan gì đến build. Chỉ nên fail lúc
// thật sự gửi email (runtime), và fail đó đã được route request-otp bọc
// try/catch để không lộ ra client.
let resendClient: Resend | undefined;

function getResendClient(): Resend {
  resendClient ??= new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

// "onboarding@resend.dev" chỉ dùng được cho môi trường test (Resend giới hạn
// gửi tới chính email chủ tài khoản khi dùng domain mặc định này) — đổi sang
// domain riêng đã verify trên Resend dashboard (vd noreply@bqdmath.edu.vn)
// khi lên production, xem .env.example.
const DEFAULT_FROM = "BQD Math <onboarding@resend.dev>";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderOtpEmailHtml(fullName: string, otp: string): string {
  return `<!DOCTYPE html>
<html lang="vi">
  <body style="margin:0;padding:0;background-color:#E8F4FD;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#E8F4FD;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:480px;background-color:#ffffff;border-radius:24px;overflow:hidden;">
            <tr>
              <td style="background-color:#1B2A4A;padding:20px 32px;">
                <span style="color:#ffffff;font-size:20px;font-weight:700;">BQD Math</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;color:#1B2A4A;font-size:16px;">
                  Chào ${escapeHtml(fullName)},
                </p>
                <p style="margin:0 0 24px;color:#1B2A4A;font-size:15px;line-height:1.6;">
                  Đây là mã xác thực để đặt lại mật khẩu tài khoản BQD Math của bạn:
                </p>
                <div style="text-align:center;margin:0 0 24px;">
                  <span style="display:inline-block;font-size:34px;font-weight:700;letter-spacing:10px;color:#1B2A4A;background-color:#E8F4FD;padding:16px 20px;border-radius:16px;">
                    ${otp}
                  </span>
                </div>
                <p style="margin:0;color:#5972B4;font-size:13px;line-height:1.6;">
                  Mã có hiệu lực trong 5 phút. Nếu bạn không yêu cầu đặt lại mật
                  khẩu, hãy bỏ qua email này.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendOtpEmail(
  to: string,
  fullName: string,
  otp: string,
): Promise<void> {
  const { error } = await getResendClient().emails.send({
    from: process.env.EMAIL_FROM ?? DEFAULT_FROM,
    to,
    subject: "Mã xác thực đặt lại mật khẩu BQD Math",
    html: renderOtpEmailHtml(fullName, otp),
  });

  if (error) {
    // SDK Resend KHÔNG throw khi API trả lỗi (sai key, domain chưa verify,
    // vượt quota...) — chỉ trả { data: null, error }. Tự throw ở đây để nơi
    // gọi (route request-otp) log được, không bị nuốt im lặng.
    throw new Error(`Gửi email OTP thất bại: ${error.message}`);
  }
}

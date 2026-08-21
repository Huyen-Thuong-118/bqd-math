/**
 * Footer — thông tin liên hệ hiển thị cuối MỌI trang.
 * Dữ liệu thật (địa chỉ, sđt, link fb) sẽ lấy từ bảng ContactInfo
 * qua features/notifications hoặc 1 bảng settings riêng — hiện để placeholder.
 */
export function Footer() {
  return (
    <footer className="mt-auto border-t border-navy-100 bg-pastel-50 py-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 text-sm text-navy-400">
        <p>© {new Date().getFullYear()} BQD Math — Hệ thống ôn luyện & thi thử Toán</p>
        <div className="flex flex-wrap gap-4">
          {/* TODO: thay href thật + link Google Maps cho địa chỉ */}
          <a href="#" className="hover:text-navy-600">
            📍 Địa chỉ
          </a>
          <a href="#" className="hover:text-navy-600">
            👍 Facebook
          </a>
          <a href="#" className="hover:text-navy-600">
            📞 Zalo / SĐT
          </a>
        </div>
      </div>
    </footer>
  );
}

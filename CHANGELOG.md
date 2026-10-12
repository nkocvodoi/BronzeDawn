# Nhật ký thay đổi

Mỗi pull request đã merge vào `main` là một dòng, mới nhất ở trên. Chi tiết (nguyên nhân, cách làm, số
liệu đo, cách kiểm tra) nằm trong mô tả của từng PR. Danh sách tính năng đã có và còn thiếu nằm ở
[replica/roadmap.md](replica/roadmap.md).

Mỗi PR mới thêm một dòng vào đầu danh sách.

## 2026-10-12

- [#66](https://github.com/nkocvodoi/BronzeDawn/pull/66) Đảo phụ của Small Islands có rừng; máy biết chở dân sang đảo khác đốn gỗ khi đảo nhà sắp hết cây, hết rừng thì sang đảo tiếp hoặc về nhà

## 2026-10-11

- [#65](https://github.com/nkocvodoi/BronzeDawn/pull/65) Thu hoạch và xây dựng nhanh hơn: chỉ còn 3/4 thời gian cho mọi người; máy Hard/Hardest thu hoạch nhanh hơn 15% (trước là 20%) và biết đóng lính phòng thủ thay vì giữ tiền lên đời
- [#64](https://github.com/nkocvodoi/BronzeDawn/pull/64) Form Game Settings (Single Player và Multiplayer) căn thẳng hàng: nhãn một cột, ô chọn bên cạnh, hai mục ngắn chung một hàng
- [#63](https://github.com/nkocvodoi/BronzeDawn/pull/63) Xác thú chồng nhau không còn thối mất: xác chỉ thối khi bắt đầu được xẻ; không xoá được Town Center cuối cùng, xoá nhà đã xây phải bấm Delete hai lần
- [#62](https://github.com/nkocvodoi/BronzeDawn/pull/62) Nhà đổ bóng xuống đất về phía dưới bên phải, tường sáng tối mượt dần thay cho các dải pixel
- [#61](https://github.com/nkocvodoi/BronzeDawn/pull/61) Không còn đàn thú bị rừng bao kín: chỉ thả và cho gặm cỏ ở đất không có cây, con nào vẫn bị kẹt thì cả đàn được dời ra bãi trống gần nhất
- [#60](https://github.com/nkocvodoi/BronzeDawn/pull/60) Thuyền, máy bắn đá, tháp công thành và cá sấu vẽ lại thành khối có ánh sáng ở độ phân giải gốc: toàn bộ quân và thú giờ đều theo hình mới
- [#59](https://github.com/nkocvodoi/BronzeDawn/pull/59) Hình ảnh mới ở độ phân giải gốc: dân làng, lính bộ, kỵ binh, xe chiến, voi chiến, thú, cây, mỏ và bụi dâu vẽ lại thành khối có ánh sáng; công trình và mọi hình còn lại mịn gấp đôi, chân tường có bóng
- [#58](https://github.com/nkocvodoi/BronzeDawn/pull/58) AI trên bản đồ đảo dứt điểm được bên thua: đánh Dock từ bờ, tàu chiến đi đánh khi đối thủ đã yếu, thuyền chở quân không còn kẹt khi đầy dân số, tìm tới lính còn sót trên đảo khác (20 trận: Khó thắng 17, trước 13; trận hết giờ còn 1, trước 6)
- [#57](https://github.com/nkocvodoi/BronzeDawn/pull/57) Đợt test: test mọi lệnh và lệnh từ máy khác (tìm và sửa một lỗi làm sập trận online), test so từng hình (1.896 hình), smoke test nhóm quân, Delete, lưu/tải file, Settings phòng chờ; CI chạy cả các bài test trên trình duyệt
- [#56](https://github.com/nkocvodoi/BronzeDawn/pull/56) Hết lag cuối trận khi xem 8 AI ở tốc độ cao (dân không còn tìm đường mãi tới cây không tới được); hươu chỉ ở vùng đất trống, không ở dải đất hẹp trông như đảo; thuyền ra từ Dock ở vùng biển lớn, không ra vũng nước
- [#55](https://github.com/nkocvodoi/BronzeDawn/pull/55) Chạy mượt hơn khi trận đông: chỉ xử lý và vẽ những gì trong màn hình (trước đây cả bản đồ, kể cả hàng nghìn cây và mỏ), tìm kẻ địch gần nhất theo ô bản đồ (mô phỏng nhanh hơn khoảng 17%, kết quả giống hệt), vòng chọn và thanh máu chỉ tạo khi được chọn, nền địa hình chỉ giữ trên GPU (bớt 10–80 MB tùy cỡ bản đồ)
- [#54](https://github.com/nkocvodoi/BronzeDawn/pull/54) Hươu đi theo bầy 4–7 con và đi cùng nhau; con bị đánh thì chạy rồi quay về bầy; sư tử săn hươu. Thú, mỏ và bụi dâu không còn bị đặt trên dải cát giữa biển. Căn cứ bị rừng bao kín thì có lối chặt sẵn ra bờ biển; AI trên bản đồ đảo xây được Dock cả khi gần đó không có cá. Nhà có cờ màu người chơi ở mọi thời đại (trước chỉ có ở Stone Age), núm mái vòm nhà Babylon theo màu người chơi thay vì màu vàng
- [#53](https://github.com/nkocvodoi/BronzeDawn/pull/53) Online: host rời thì người có số nhỏ nhất làm host thay, những người khác tự vào lại; chỉ còn một người thì chơi tiếp một mình
- [#52](https://github.com/nkocvodoi/BronzeDawn/pull/52) Online: rớt mạng thì vào lại được trận đang chơi (nút Rejoin, hoặc từ Multiplayer sau khi tải lại trang)
- [#51](https://github.com/nkocvodoi/BronzeDawn/pull/51) Online: chat trong trận (Enter); máy chơi thay người rời trận; host tạm dừng thì mọi máy dừng ở cùng một lượt
- [#50](https://github.com/nkocvodoi/BronzeDawn/pull/50) Online: mọi người chịu cùng một độ trễ ngắn, tự đo theo mạng; lính bước đi ngay trên màn hình khi ra lệnh

## 2026-10-10

- [#49](https://github.com/nkocvodoi/BronzeDawn/pull/49) Online: lệnh chờ ít hơn (host gần như ngay lập tức, người tham gia một vòng mạng)
- [#48](https://github.com/nkocvodoi/BronzeDawn/pull/48) Online: phòng chờ kiểu bản gốc (8 ghế, tên, dân tộc, đội, Ready, chat, Settings); chơi không cần máy
- [#47](https://github.com/nkocvodoi/BronzeDawn/pull/47) Màn hình chính hai bước kiểu bản gốc; gõ mã phòng không bị lẫn phím tắt; bảng đang vào phòng; hết vệt tối khi tài nguyên cạn hoặc bị xóa
- [#46](https://github.com/nkocvodoi/BronzeDawn/pull/46) Online: trận không đứng khi một cửa sổ bị ẩn, báo khi đang chờ; bỏ qua địa chỉ relay gõ sai
- [#45](https://github.com/nkocvodoi/BronzeDawn/pull/45) Online: mã phòng 6 số, báo rõ khi không nối được, máy chủ TURN tùy chọn
- [#44](https://github.com/nkocvodoi/BronzeDawn/pull/44) AI trên bản đồ đảo: chỉ dùng tài nguyên đi bộ tới được, đổ bộ đúng vùng đất
- [#43](https://github.com/nkocvodoi/BronzeDawn/pull/43) Chơi online với bạn bè: lockstep qua WebRTC (giai đoạn 5, phần 4)
- [#42](https://github.com/nkocvodoi/BronzeDawn/pull/42) Lưu và tải trận (giai đoạn 5, phần 3)
- [#41](https://github.com/nkocvodoi/BronzeDawn/pull/41) 5 mức AI như bản gốc, từ Easiest tới Hardest (giai đoạn 5, phần 2)
- [#40](https://github.com/nkocvodoi/BronzeDawn/pull/40) Chia đội tùy ý, trạng thái ngoại giao và cống nạp (giai đoạn 5, phần 1)
- [#39](https://github.com/nkocvodoi/BronzeDawn/pull/39) Sửa nền đen ở vùng đã khám phá
- [#38](https://github.com/nkocvodoi/BronzeDawn/pull/38) AI trên bản đồ đảo: Dock trên bờ đảo mình, để dành gỗ đóng thuyền chở quân, chở cả đợt qua biển

## 2026-10-09

- [#37](https://github.com/nkocvodoi/BronzeDawn/pull/37) Đưa giai đoạn 4, phần 2 đến 4 lên main (#34, #35, #36)
- [#36](https://github.com/nkocvodoi/BronzeDawn/pull/36) Bản đồ Highland, Hill Country, Narrows và cỡ Gigantic (giai đoạn 4, phần 4)
- [#35](https://github.com/nkocvodoi/BronzeDawn/pull/35) Đồi, vách đá, vùng nước nông và lợi thế đánh từ trên cao (giai đoạn 4, phần 3)
- [#34](https://github.com/nkocvodoi/BronzeDawn/pull/34) Ruins, Artifact và chiến thắng bằng chúng (giai đoạn 4, phần 2)
- [#33](https://github.com/nkocvodoi/BronzeDawn/pull/33) Tùy chọn trận ở màn hình bắt đầu; thắng theo điểm hoặc hết giờ (giai đoạn 4, phần 1)
- [#32](https://github.com/nkocvodoi/BronzeDawn/pull/32) Thuyền chở quân, bản đồ đảo, buôn bán và AI trên biển (giai đoạn 3, phần 3 và 4)
- [#31](https://github.com/nkocvodoi/BronzeDawn/pull/31) Xác quân mờ dần trong ba giây
- [#30](https://github.com/nkocvodoi/BronzeDawn/pull/30) Thợ xây tự sang công trình dở dang gần đó
- [#29](https://github.com/nkocvodoi/BronzeDawn/pull/29) Tối đa 5 thuyền đánh cá cho mỗi Dock
- [#28](https://github.com/nkocvodoi/BronzeDawn/pull/28) Tàu chiến và bonus tàu của các dân tộc (giai đoạn 3, phần 2)
- [#27](https://github.com/nkocvodoi/BronzeDawn/pull/27) Dock, thuyền đánh cá và bản đồ có biển (giai đoạn 3, phần 1)
- [#26](https://github.com/nkocvodoi/BronzeDawn/pull/26) Biểu đồ điểm theo thời gian (Timeline)
- [#25](https://github.com/nkocvodoi/BronzeDawn/pull/25) Tùy chọn ruộng chặn đường như bản gốc
- [#24](https://github.com/nkocvodoi/BronzeDawn/pull/24) Chế độ chỉ xem các máy đánh nhau
- [#23](https://github.com/nkocvodoi/BronzeDawn/pull/23) Vị trí xuất phát ngẫu nhiên; AI bỏ đuổi khi quá xa, mức Khó đánh muộn hơn
- [#22](https://github.com/nkocvodoi/BronzeDawn/pull/22) Điểm số kiểu bản gốc, Martyrdom và phím Tab
- [#21](https://github.com/nkocvodoi/BronzeDawn/pull/21) Danh sách người chơi trên bản đồ nhỏ: dân số hoặc điểm
- [#20](https://github.com/nkocvodoi/BronzeDawn/pull/20) Tới 7 máy
- [#19](https://github.com/nkocvodoi/BronzeDawn/pull/19) Thời gian còn lại khi luyện quân, nghiên cứu, lên đời và xây
- [#18](https://github.com/nkocvodoi/BronzeDawn/pull/18) Stand ground, Attack ground và điểm đi qua
- [#17](https://github.com/nkocvodoi/BronzeDawn/pull/17) Cây công nghệ riêng của từng dân tộc; AI không còn đứng yên khi hết vàng
- [#16](https://github.com/nkocvodoi/BronzeDawn/pull/16) Sửa công trình, công trình bốc cháy và gạch vụn
- [#15](https://github.com/nkocvodoi/BronzeDawn/pull/15) Tùy chọn ruộng tự trồng lại
- [#14](https://github.com/nkocvodoi/BronzeDawn/pull/14) Thêm dân tộc Lạc Việt
- [#13](https://github.com/nkocvodoi/BronzeDawn/pull/13) Bộ nạp tài nguyên, để hình và âm thanh có thể lấy từ file

## 2026-10-08

- [#12](https://github.com/nkocvodoi/BronzeDawn/pull/12) Sương mù kiểu bản gốc, nền có vân và rừng dày
- [#11](https://github.com/nkocvodoi/BronzeDawn/pull/11) Giao diện kiểu bản gốc, âm thanh, con trỏ theo ngữ cảnh, khóa chuột, sương mù trên mọi cỡ bản đồ
- [#10](https://github.com/nkocvodoi/BronzeDawn/pull/10) Danh sách tài nguyên hình và âm thanh game có thể dùng
- [#9](https://github.com/nkocvodoi/BronzeDawn/pull/9) Roadmap và bảng tính năng chi tiết
- [#8](https://github.com/nkocvodoi/BronzeDawn/pull/8) Giao diện kiểu bản gốc, phím tắt menu xây và các cỡ bản đồ
- [#7](https://github.com/nkocvodoi/BronzeDawn/pull/7) Hiện dân tộc của bạn và các bonus
- [#6](https://github.com/nkocvodoi/BronzeDawn/pull/6) Đưa #4 (mục tiêu nhấp nháy) lên main
- [#5](https://github.com/nkocvodoi/BronzeDawn/pull/5) Sửa: chuột phải vào công trình xây dở thì dân làng quay lại xây tiếp
- [#4](https://github.com/nkocvodoi/BronzeDawn/pull/4) Mục tiêu của lệnh nhấp nháy như bản gốc
- [#3](https://github.com/nkocvodoi/BronzeDawn/pull/3) Tốc độ game 1x, 1.5x, 2x, 3x
- [#2](https://github.com/nkocvodoi/BronzeDawn/pull/2) Pixel art, sửa logic và lối chơi 4 thời đại như bản gốc
- [#1](https://github.com/nkocvodoi/BronzeDawn/pull/1) Bản web: chơi Bronze Dawn trên trình duyệt

# Nhật ký thay đổi

Mỗi pull request đã merge vào `main` là một dòng, mới nhất ở trên. Chi tiết (nguyên nhân, cách làm, số
liệu đo, cách kiểm tra) nằm trong mô tả của từng PR. Danh sách tính năng đã có và còn thiếu nằm ở
[replica/roadmap.md](replica/roadmap.md).

Mỗi PR mới thêm một dòng vào đầu danh sách.

## 2026-10-17

- [#146](https://github.com/nkocvodoi/BronzeDawn/pull/146) Elf thay đổi theo từng đời: công trình (chòi lá, gỗ sống, vòm lụa xanh ngọc, bạc và kính lá), dân phục và quân phục theo đời, kỵ binh cưỡi nai; hình dân/lính theo đời (`elf/villager@bronze`). Wonder của 4 tộc là tượng khổng lồ dựng bằng metaball: nữ thần cây, thần thợ rèn, ngựa chồm, rồng trên núi đá
- [#145](https://github.com/nkocvodoi/BronzeDawn/pull/145) Tộc giả tưởng: kế hoạch đồ họa đã duyệt, công trình thành khu nhiều phần (nhà phụ, rào, đồ nghề, đèn và tượng của tộc), cắt gọn vào giữa khung, biểu tượng riêng cho 4 công nghệ riêng; trang so sánh `web/scripts/race-review.mjs`

## 2026-10-16

- [#144](https://github.com/nkocvodoi/BronzeDawn/pull/144) Công trình theo 5 bộ kiến trúc (Ai Cập, Babylon, Châu Á, Hy Lạp, La Mã; thay cho #141) và kế hoạch sửa hình đã duyệt: tường, mái có vân gạch, đá, ngói; nắng gắt hơn, màu đất; nền đất có rêu và đồ vật; công trình thành khu (doanh trại có sân tập, chuồng ngựa có bãi quây, bãi chứa ngoài trời); tháp, bến, ruộng riêng từng kiến trúc; nhà và kho lúa riêng từng đời; chợ và trường bắn làm lại; tượng Phật ở tháp chùa. Render lại cả 635 hình. So với bản gốc: 59 → 67/100
- [#143](https://github.com/nkocvodoi/BronzeDawn/pull/143) `python3 art3d/compare.py`: đặt hình của Bronze Dawn cạnh hình AoE gốc (từ repo riêng BronzeDawn-aoe-data) và chấm 8 thước đo (cỡ, chi tiết, tương phản, độ sáng, độ đậm màu, bảng màu, màu phe, viền tối). Lần đầu: 59/100, yếu nhất là chi tiết (ít hơn 2 lần) và bảng màu (35% trùng)
- [#142](https://github.com/nkocvodoi/BronzeDawn/pull/142) Máy trên đảo: Barracks đầu tiên không còn bị giữ gỗ cho Storage Pit bên kia biển (có trận 90 phút máy không có lính nào); đảo ít gỗ thì giữ gỗ cho thuyền chở quân từ khi có Dock. Phần giao tranh khi đổ bộ còn mở, ghi trong roadmap

## 2026-10-15

- [#140](https://github.com/nkocvodoi/BronzeDawn/pull/140) Gợi ý cho người mới: công trình quân sự và nâng cấp hợp với thế mạnh dân tộc (Hittite: Siege Workshop, Archery Range, giáp cung thủ...) sáng hơn có viền vàng cho tới khi đã xây hoặc nghiên cứu; bật sẵn, tắt được trong Cài đặt
- [#139](https://github.com/nkocvodoi/BronzeDawn/pull/139) Cân bằng lại 4 tộc fantasy (đo 170 trận mỗi tộc, ở mức Hard và Moderate): Elf gỗ ×1.1, Glade Archer 50f 50w; Dwarf Ironclad 50f, Deep Arbalest 45f; Centaur tốc độ dân +0.1; Beastfolk máu dân +5, luyện barracks ×0.9, Wolfkin 70f. Tỉ lệ thắng ở Hard giờ 53–56%
- [#138](https://github.com/nkocvodoi/BronzeDawn/pull/138) Self-test mục 5: chốt giữ luật đồ dân đang mang đi theo lên thuyền
- [#137](https://github.com/nkocvodoi/BronzeDawn/pull/137) Máy trên đảo cạn sạch không còn đứng không: thiếu gỗ vẫn chở dân sang đảo khác chặt rồi đón về; hết việc cần thì đào đá; tới 3 chuyến thuyền cùng lúc. Đổi luật: đồ dân đang mang đi theo lên thuyền, không mất như trước. Soak 216 trận: số lần kẹt trên bản đồ đảo từ 12 xuống 5
- [#136](https://github.com/nkocvodoi/BronzeDawn/pull/136) `npm run monkey`: chơi bừa trên Chrome thật (bấm, kéo, phím, bấm nút trong các bảng) và bắt lỗi trang, bảng kẹt, đứng hình, đồng hồ dừng; 8 trận, khoảng 5200 thao tác, không lỗi nào
- [#135](https://github.com/nkocvodoi/BronzeDawn/pull/135) `npm run ui-shots` chụp 22 màn hình ở 5 cỡ (điện thoại dọc và ngang, laptop, 1080p, 4K) và tự kiểm bố cục. Sửa: trên điện thoại nút Menu ngoài màn hình (giao diện giờ co tới 0,45 lần; cầm dọc thì có dòng nhắc xoay ngang), khung menu chính lẹm mép; trên 4K các bảng bé xíu (giờ phóng theo màn hình, tới 2,2 lần)
- [#134](https://github.com/nkocvodoi/BronzeDawn/pull/134) Sàng lọc lỗi: `npm run soak` chạy hàng loạt trận máy đấu máy và kiểm luật bất biến (120 trận × 3 lượt: không vỡ, lưu/tải và cùng seed chạy y hệt); F8 lưu báo lỗi mở lại được đúng trận (`npm run report`); `replica/self-test.md` ghi lỗi tìm được. Sửa: thanh máu công trình treo trên cột cờ; máy trên đảo nhỏ đặt Temple sang đảo khác nên kẹt Bronze Age; mất Town Center thì không xây lại
- [#133](https://github.com/nkocvodoi/BronzeDawn/pull/133) Thanh máu của unit ở một độ cao cố định theo loại unit và hướng quay (trước đây nhảy lên theo dụng cụ đang giơ: câu cá +32 px, đào mỏ +17, xây +13; 3/9 dân bị cao), và nằm trên mọi thứ, không còn bị cây hay nhà che

## 2026-10-14

- [#132](https://github.com/nkocvodoi/BronzeDawn/pull/132) Hết nhấp nháy sáng tối khi lướt bản đồ trên PC đặt Scale 125%/150%: lưới chấm của sương mù và vị trí bản đồ tính theo điểm ảnh thật
- [#131](https://github.com/nkocvodoi/BronzeDawn/pull/131) Thanh máu và lửa nhà cháy nằm đúng trên hình (trước đây bay lơ lửng vì đặt theo khung hình 3D); đơn vị, công trình vừa bị đánh tự hiện thanh máu 15 giây; icon dân và công trình của 4 tộc mới dùng hình của tộc; bỏ giới hạn 25 đơn vị khi kéo chuột hoặc ấn đúp để chọn; cờ tập hợp quân (F) đánh trong bán kính bằng tầm xa nhất của quân được chọn (ít nhất 6 ô)
- [#130](https://github.com/nkocvodoi/BronzeDawn/pull/130) AI đảo (bước 2): thuyền vận tải đổ quân xong quay về bờ nhà thay vì đậu lại bãi đối phương để bị bắn chìm, chọn bãi đổ bộ tránh tháp, thời Đồ Đá không giữ gỗ cho thuyền (Barracks không còn trễ), sang đảo đối phương chặt gỗ xa nhà chính của họ, được xây nhà khi chạm trần dân số; Hard thắng Easy 36/96 thay vì 32/96 trên Tiny Small/Large Islands (thua vẫn 16)
- [#129](https://github.com/nkocvodoi/BronzeDawn/pull/129) Ctrl + '+' / '-' và Ctrl + lăn chuột chỉ phóng to, thu nhỏ bản đồ, không zoom cả trang (giao diện giữ nguyên cỡ)
- [#128](https://github.com/nkocvodoi/BronzeDawn/pull/128) Công trình riêng của 4 tộc giả tưởng (Blender, 184 hình): Elf nhà gỗ sống mái lá, Town Center là cây cổ thụ, Wonder là Cây Thế Giới; Dwarf nhà đá đào vào núi, Temple là lò rèn, Wonder là cổng núi; Centaur lều vải và nhà cột, Temple là đài thiên văn; Beastfolk lều da, nhà dài, cột vật tổ, Wonder là gò đầu lâu thú. Chỉ dùng cho người chơi của đúng tộc đó, chỉ tải khi trận có tộc đó
- [#127](https://github.com/nkocvodoi/BronzeDawn/pull/127) AI trên đảo không còn cạn gỗ (Elf ở Large Islands 8 người từng kẹt Tool Age với 28 gỗ, chỉ luyện Clubman): Storage Pit ở đảo khác được đặt cả khi vừa cập bờ, thuyền riêng chở dân đi đốn, để dành gỗ sớm hơn và tạm không trồng lại ruộng; Elf giờ lên Iron Age, có Archery Range và cung thủ. Máy săn voi theo nhóm 5 người thay vì gửi từng người một. Toàn bộ tộc Elf (dân và 15 loại lính) mặc bikini da gấu
- [#126](https://github.com/nkocvodoi/BronzeDawn/pull/126) Nút Resign (hỏi lại một lần, chơi online vẫn khớp); Menu chia nhóm và có trang Settings riêng (tốc độ, ruộng tự trồng lại, âm thanh, nhạc, toàn màn hình, giữ chuột, phím tắt); nút lệnh hiện phím tắt ở góc (tắt được); chọn nhiều quân thì ô trạng thái hiện số lượng theo loại và hình kèm thanh máu của từng con (bấm để chọn riêng, Shift để bỏ ra); con trỏ cần câu khi trỏ vào cá
- [#125](https://github.com/nkocvodoi/BronzeDawn/pull/125) Hình Blender cho 4 tộc giả tưởng theo phong cách anime: người dân đủ 9 nghề (Elf phần lớn là nữ, tóc vàng, tai nhọn, săn bằng cung và đánh bằng dao găm; Dwarf thấp bè râu tết; nhân mã bốn chân; Beastfolk mặt người tai và đuôi mèo) và 8 unit riêng (người cây, nỏ quay tay, người sói hai rìu, người gấu chùy đá...); tộc Sagittarian đổi tên thành Centaur; hình riêng của một dân tộc chỉ tải khi trận có dân tộc đó; gallery có mục `fantasy`
- [#124](https://github.com/nkocvodoi/BronzeDawn/pull/124) 4 tộc giả tưởng (Elf, Dwarf, Sagittarian, Beastfolk) luôn có trong danh sách chọn dân tộc: 8 unit và 4 tech riêng trong `data/fantasy.json`, AI luyện unit riêng, `npm run sim:races` đo tỉ lệ thắng (sau khi chỉnh: 60%, 50%, 58%, 61%; dân tộc gốc 45–64%)
- [#123](https://github.com/nkocvodoi/BronzeDawn/pull/123) Tùy chọn Full tech tree như AoE2 (tắt sẵn): mọi dân tộc có đủ cây công nghệ chung, vẫn giữ bonus; có cả khi chơi online và trong file lưu
- [#122](https://github.com/nkocvodoi/BronzeDawn/pull/122) Market có nút Tribute (phím T): cống nạp 100, 500 hoặc 1000 mỗi lần, hiện giá kèm phí, nút nào không đủ tiền thì mờ; cống nạp vẫn không cần Market như bản gốc
- [#120](https://github.com/nkocvodoi/BronzeDawn/pull/120) Đề xuất 4 tộc giả tưởng (Elf, Dwarf, Sagittarian, Beastfolk): bonus theo cùng biên độ Rise of Rome, unit và tech riêng, số kiểm bằng `balance.py`, hướng hình ảnh, 8 tộc gợi ý thêm, cách đưa vào (`replica/game/fantasy-races.md`)
- [#119](https://github.com/nkocvodoi/BronzeDawn/pull/119) Tự đặt phím tắt (trang Keys trong Help): mỗi thao tác 2 ô, nhận phím kèm Ctrl/Alt/Shift hoặc nút chuột giữa và 2 nút phụ; lệnh trên bảng giữ chữ cái gốc và có thêm một ô; nút phụ không còn làm trình duyệt lùi trang. Trang Help chia tab: Getting started 6 bước, Mouse, Keys, Build & train, Rules, Civilizations
- [#118](https://github.com/nkocvodoi/BronzeDawn/pull/118) Thuyền, sư tử, cá sấu (bộ hình 3D) to gấp 1,5 lần, render lại cho sắc nét; nghiên cứu Catapult Trireme cần Trireme trước như trong `empires.dat` (trước đây mở ngay ở Iron Age)

## 2026-10-13

- [#117](https://github.com/nkocvodoi/BronzeDawn/pull/117) AI trên đảo ít gỗ (Tiny Small Islands của bản gốc gần như không có rừng, kiểm bằng 4 file save Tiny): giữ gỗ cho thuyền vận tải và Storage Pit ở đảo khác, thời Đồ Đá chỉ xây Dock và Barracks, ít dân làng hơn, không để dành cho đời sau khi dân đã hết việc; Hard thắng Easy 9/24 thay vì 7/24 (chưa đạt mục tiêu)
- [#116](https://github.com/nkocvodoi/BronzeDawn/pull/116) Bản đồ giống hệt bản gốc: cùng seed thì đúng từng ô địa hình và độ cao, mọi vật thể (nhà chính, mỏ, bụi quả, cá, cây, vách đá, cây rừng và đá cỏ tự sinh) đúng chỗ, kiểm tra trên cả 18 file save; đọc file save đúng byte, chia vùng đất cho đồng minh như bản gốc, Inland có lại sông; máy không đuổi con mồi sang phía đối thủ và luyện quân khi đối thủ đông hơn
- [#115](https://github.com/nkocvodoi/BronzeDawn/pull/115) Bản đồ: mỏ, bụi quả, thú, nhà chính chỉ đặt trên loại đất mà bản gốc cho phép (bảng terrain restriction của `empires.dat`), nên trên đảo không còn nằm ở bãi biển mép đảo. So cả 9 kiểu bản đồ với 2 file save mỗi kiểu, tìm được seed thật của từng file (`scripts/aoe/find-seed.ts`), phần đặt vùng đất khớp bản gốc tới từng ô. Máy chỉ dựng thêm Storage Pit/Granary khi đã có Barracks
- [#97](https://github.com/nkocvodoi/BronzeDawn/pull/97) Bản đồ lấy đúng số liệu của từng kiểu: bản gốc lấy bản đồ theo vị trí trong `empires.dat`, không theo id ghi trong bản ghi, nên trước đây 8/9 kiểu dùng nhầm số của kiểu khác (Mediterranean 39% nước thay vì ~21%, Inland không có nước, Hill Country có biển). So bằng file save của game gốc (`scripts/aoe/gmx.ts`, `compare-maps.ts`). Máy dựng Storage Pit/Granary cạnh rừng, đàn thú, bụi quả ở xa trên mọi bản đồ

## 2026-10-12

- [#96](https://github.com/nkocvodoi/BronzeDawn/pull/96) Bản đồ ngẫu nhiên sinh theo đúng thuật toán của Empiresx.exe, số liệu 9 kiểu bản đồ lấy từ empires.dat (vị trí và khoảng cách vàng, đá, bụi quả, linh dương, cá, rừng, đồi, vách đá, nước nông như bản gốc; cỡ bản đồ đúng bản gốc); AI tìm quả và săn xa hơn theo khoảng cách của bản gốc
- [#93](https://github.com/nkocvodoi/BronzeDawn/pull/93) Máy (từ mức Moderate) chơi theo thế mạnh dân tộc, đọc từ bonus: nhà lính hợp dân tộc xây trước và thêm cái thứ hai từ Bronze Age, được luyện quân trước, ưu tiên loại quân được bonus, nâng cấp dòng quân đó sớm, dân tộc giỏi biển có thêm tàu; `npm run sim:civ` đo bằng trận máy đấu máy
- [#95](https://github.com/nkocvodoi/BronzeDawn/pull/95) Mọi số liệu là của Rise of Rome lấy từ `empires.dat`: thời gian luyện tàu gấp đôi trước, thời gian nạp kỵ binh và xe chiến 1,5 s, Wonder 8000, mỏ đá 250, thú và thịt thối như bản gốc, công nghệ đúng đối tượng và số; thu hoạch và xây không còn nhanh hơn bản gốc; trình nhập sửa đòn của tàu bắn đá và sư tử, lương thực ruộng, tốc độ thối của thịt
- [#92](https://github.com/nkocvodoi/BronzeDawn/pull/92) Bonus của 16 dân tộc là đúng số của Rise of Rome, lấy thẳng từ `empires.dat` (Assyrian bắn mỗi 1,1 s, Egyptian đào vàng +44% và mang thêm 2, Sumerian ruộng +250, Babylonian hồi faith ×1,375...); hiệu ứng "set" như bản gốc; trình nhập AoE chuyển được mọi bonus dân tộc
- [#91](https://github.com/nkocvodoi/BronzeDawn/pull/91) Ruins vẽ lại thành vòng đá cổ, Artifact thành rương vàng trên đòn khiêng (Blender), có hình riêng lúc có người giữ; art3d chạy được trên Windows
- [#90](https://github.com/nkocvodoi/BronzeDawn/pull/90) Smoke test nạp art pack dạng zip (các file trong thư mục con), dùng sau khi tải lại trang, rồi xoá
- [#89](https://github.com/nkocvodoi/BronzeDawn/pull/89) Tài liệu sau đợt nhập AoE: hướng dẫn nhập lại và đưa sang máy khác (replica/aoe-reimport.md, thay cho danh sách việc đã xong), roadmap cập nhật phần hình, Art Packs, kiểm thử và bỏ việc tinh chỉnh âm thanh
- [#88](https://github.com/nkocvodoi/BronzeDawn/pull/88) Trình nhập AoE lấy vách đá của game gốc (mảnh 3×3 của "Cliffs_1" theo hướng vách chạy) vào khoá `cliffs` của art pack
- [#87](https://github.com/nkocvodoi/BronzeDawn/pull/87) Công trình đang xây hiện công trường theo từng giai đoạn: trình nhập AoE lấy hình công trường của game gốc vào khoá mới `construction`, game chọn hình theo tiến độ xây
- [#86](https://github.com/nkocvodoi/BronzeDawn/pull/86) Mọi unit, công trình và ô đất còn lại dựng bằng code trong art3d/ và render bằng Blender (27 loại lính, 5 máy công thành, 12 tàu, 19 công trình theo thời đại, Thời đồ đá vẽ lại)
- [#85](https://github.com/nkocvodoi/BronzeDawn/pull/85) Xoá unit không còn sót hình; săn thú chỉ còn xác, không còn thân mờ bên cạnh; người dân đi bộ nốt đoạn cuối tới chỗ làm thay vì trượt; `BD_ASSETS=default` để xem hình của game trên máy đã nhập AoE
- [#84](https://github.com/nkocvodoi/BronzeDawn/pull/84) Vẽ lại bằng Blender: bụi quả, mỏ vàng, mỏ đá, linh dương (gặm cỏ, chạy) và xác của nó; người dân ngồi xổm xẻ thịt, bỏ vào giỏ đặt cạnh
- [#83](https://github.com/nkocvodoi/BronzeDawn/pull/83) Phím tắt tới công trình như bản gốc: H tới Town Center, Ctrl+B Barracks, Ctrl+A Archery Range, Ctrl+L Stable, Ctrl+K Siege Workshop, Ctrl+Y Academy, Ctrl+P Temple, Ctrl+D Dock; bấm lại để sang cái kế tiếp
- [#82](https://github.com/nkocvodoi/BronzeDawn/pull/82) Vách đá vẽ lại bằng Blender, nối với ô bên cạnh thành một sống núi đá liền thay cho dãy khối lặp lại
- [#81](https://github.com/nkocvodoi/BronzeDawn/pull/81) Menu và màn cài đặt cuộn được khi cao hơn màn hình (laptop, điện thoại), kể cả khi game đang giữ chuột
- [#80](https://github.com/nkocvodoi/BronzeDawn/pull/80) Người dân đang làm được vẽ sát cây, mỏ, bụi quả thay vì đứng cách xa (chỉ đổi hình, cách game chạy giữ nguyên)
- [#79](https://github.com/nkocvodoi/BronzeDawn/pull/79) Sprite kiểu pixel như game cuối thập niên 90 (viền cứng, viền tối, ít màu), và người dân đủ nghề: chặt cây vung ngang, đào mỏ bằng cuốc, đóng búa khi xây, ôm giỏ hái quả
- [#78](https://github.com/nkocvodoi/BronzeDawn/pull/78) Bộ sprite đầu tiên dựng bằng Blender (art3d/): người dân, Town Center và nhà Thời đồ đá, cây
- [#76](https://github.com/nkocvodoi/BronzeDawn/pull/76) Ghi lại các việc cần làm trên máy có cài AoE (replica/todo-aoe-import.md)
- [#74](https://github.com/nkocvodoi/BronzeDawn/pull/74) Bản đồ ngẫu nhiên dựng từ bộ số (RandomMapSpec); art pack có thể mang bản đồ, ô chọn Map hiện chúng với chữ "(art pack)"
- [#75](https://github.com/nkocvodoi/BronzeDawn/pull/75) Người dân cử động khi làm việc với art pack: trình nhập lấy hoạt ảnh hái quả, đào mỏ, cày ruộng, xây, đánh cá từ đúng chỗ của bản gốc (cần nhập lại); pack nhập từ trước thì phát hoạt ảnh đứng ở tốc độ làm việc thay vì đứng im
- [#73](https://github.com/nkocvodoi/BronzeDawn/pull/73) Ô đất từ art pack không còn đường kẻ sáng quanh mỗi ô (lấy mẫu tránh mép trong suốt của ảnh)
- [#72](https://github.com/nkocvodoi/BronzeDawn/pull/72) Công trình từ art pack đứng đúng ô của nó: `anchorAt: "center"` cho ảnh có điểm neo ở giữa công trình
- [#70](https://github.com/nkocvodoi/BronzeDawn/pull/70) Màn Art Packs ghi rõ mỗi pack đang bật hay tắt, và nút nói rõ sẽ làm gì (Turn off / Turn on)
- [#71](https://github.com/nkocvodoi/BronzeDawn/pull/71) Hotfix: ruộng tự trồng lại chỉ tốn nửa giá xây ruộng mới (38 gỗ thay vì 75, vẫn tính giảm giá theo dân tộc)
- [#69](https://github.com/nkocvodoi/BronzeDawn/pull/69) Smoke test online không còn hỏng thất thường trên CI: đợi tới khi hai máy cùng dừng ở một bước, và đợi tốc độ game của chủ phòng tới máy khách, rồi mới so
- [#68](https://github.com/nkocvodoi/BronzeDawn/pull/68) Gói hình (Art Packs): người chơi tự nạp hình và tiếng của mình từ một thư mục hoặc file zip ngay trong trình duyệt (lưu trong trình duyệt, không tải lên đâu cả), thay từng phần; kèm gói mẫu "voi chiến thành khủng long" và hướng dẫn trong replica/art-packs.md
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

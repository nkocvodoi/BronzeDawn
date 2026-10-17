# Đề xuất giao diện cho 4 tộc giả tưởng (Elf, Dwarf, Centaur, Beastfolk)

**Trạng thái:** chủ repo đã duyệt mọi mục ngày 2026-10-16 (viết cùng ngày). Làm theo thứ tự ở cuối file.

Kế hoạch này dùng cùng cách làm với [art-plan.md](art-plan.md) (5 kiến trúc người), áp cho 4 tộc giả tưởng
([game/fantasy-races.md](game/fantasy-races.md)). Phạm vi gồm công trình, dân làng, lính riêng, biểu tượng nút, khung
giao diện (HUD) và hiệu ứng.

Mỗi mục bên dưới là một việc, có mã in đậm để duyệt. Ghi "Duyệt", "Sửa: ..." hoặc "Bỏ" ngay sau mục, hoặc sửa thẳng
file này. Mọi hình đều tự dựng bằng Blender trong `art3d/` (`race_buildings.py`, `races.py`). Ý tưởng lấy từ kiến
trúc và trang phục có thật (tên trong ngoặc) và từ truyện dân gian, không chép hình của game nào.

## Hiện trạng (2026-10-16)

- Đã có 240 hình riêng (`race_buildings.py`, `races.py`):
  - 16 loại công trình × 4 thời đại × 4 tộc;
  - dân làng riêng của cả 4 tộc, đủ mọi nghề, vẽ theo kiểu anime: Elf mặc bikini da gấu như chủ repo đã chọn, Dwarf
    thấp và râu tết, Centaur thân ngựa, Beastfolk tai và đuôi mèo;
  - 15 loại lính chung mặc đồ Elf (#127);
  - 8 lính riêng.
- Mỗi tộc đã có một kiểu riêng: Elf nhà gỗ sống mái lá, Town Center là cây cổ thụ; Dwarf nhà đá đào vào núi; Centaur
  lều vải và nhà cột; Beastfolk lều da, nhà dài, cột vật tổ.
- **Các vấn đề còn lại:**
  - Mỗi công trình vẫn là một khối với ít đồ vật, giống các công trình người trước #144.
  - Nền sân là mảng đất phẳng.
  - Hình đặt lệch về phía phải dưới trong khung (đã thấy ở Town Center Iron của cả 4 tộc).
  - Màu và vật liệu giữa các thời đại chưa khác nhau đủ để thấy rõ khi nâng đời.
  - Khung giao diện vẫn dùng chung với dân tộc người. Biểu tượng dân làng và công trình đã dùng hình của tộc từ #131;
    công nghệ riêng chưa có biểu tượng riêng.

## all — Quy tắc chung (áp cho cả 4 tộc)

- **giu-quy-tac:** Áp mọi quy tắc chung của art-plan.md: nền đất thật có rêu và cỏ (`nen-dat`), lớp 10–40 đồ vật
  (`chi-tiet`), công trình là một khu nhiều phần (`quan-the`), mỗi đời lên một bậc vật liệu (`thoi-dai`), màu phe
  không quá 5% hình (`mau-phe`).
- **can-giua:** Đặt công trình vào giữa khung như công trình người, và sửa lại điểm neo. Kiểm tra bằng
  `art3d/compare.py` để không còn hình bị lệch hoặc cắt mép.
- **bang-mau:** Mỗi tộc một bảng màu đặc trưng, đủ để nhận ra ngay khi nhìn thoáng qua trên bản đồ nhỏ:
  - Elf: xanh lá, bạc, trắng ngà;
  - Dwarf: xám đá, đồng thau, đỏ lửa lò;
  - Centaur: vải kem, nâu da, xanh trời đêm;
  - Beastfolk: nâu đất, đỏ son, trắng xương.
- **thoi-dai:** Mỗi tộc có một thang vật liệu riêng qua 4 đời, ghi ở từng tộc bên dưới. Công trình đời Iron phải sáng và
  cầu kỳ hơn đời Bronze rõ rệt.
- **anh-sang:** Mỗi tộc một nguồn sáng riêng, để tối hoặc khi zoom gần vẫn nhận ra: Elf đom đóm hoặc nấm phát sáng
  xanh nhạt; Dwarf lửa lò đỏ cam ở cửa; Centaur đèn lồng treo ở lều; Beastfolk lửa trại.
- **co:** Giữ cỡ trong khung ô như công trình người, đã chỉnh ở #144. Nhà và Granary nhỏ lại khoảng 25%.

## elf — Elf: rừng sống

**Bản sắc:** sống cùng cây, không đốn cây sống. Nhà mọc từ rễ và cành, đi lại trên cầu treo giữa các cây. Vật liệu đi
từ gỗ sống sang đá trắng có khắc hoa lá rồi bạc và đá mặt trăng. Đường nét cong mềm, hoa văn dây leo xoắn (kiểu Celtic,
Art Nouveau).

- **vat-lieu:** Stone: chòi lá trên gốc cây. Tool: gỗ sống màu ngà, mái lá. Bronze: thêm đá trắng khắc hoa văn lá, dây
  leo có hoa. Iron: viền bạc, đèn đá mặt trăng, kính màu xanh nhạt ở cửa sổ tròn.
- **town_center:** Cây cổ thụ rỗng ruột, cửa trong rễ, cầu thang xoắn quanh thân, các sàn gỗ treo trên cành, đom đóm.
  Iron: tán cây có vòm bạc, cầu treo nối sang một cây nhỏ.
- **house:** Nhà tròn trong gốc cây hoặc trên cành thấp, có thang dây, chậu nấm, đèn đá.
- **granary:** Kho treo lơ lửng dưới tán (chống thú), giỏ đan bằng cành, giàn phơi quả.
- **storage_pit:** Gỗ rơi đã chết xếp gọn (không đốn cây sống), bàn chạm khắc, cung đang làm dở.
- **barracks:** Bãi tập giữa các cây, giá giáo và khiên lá, cổng vòm cành cây.
- **archery_range:** Đường bắn giữa hai hàng cây, bia làm từ khoanh gỗ, tượng nữ thần săn cầm cung bằng gỗ sống.
- **stable:** Chuồng nai sừng lớn (thay ngựa, chỉ là hình), máng nước bằng đá, cỏ khô.
- **market:** Sạp dưới tán, vải lụa xanh, giỏ quả, chai nước suối.
- **temple:** Vòng đá trắng quanh một cây thiêng, giếng ánh trăng phát sáng.
- **government_center:** Sảnh hội đồng trên sàn gỗ quanh thân cây, ghế đá xếp vòng tròn.
- **academy:** Thư viện trong thân cây, các cuộn giấy treo, ghế dài cho học trò.
- **siege_workshop:** Lán dưới tán, máy bắn đá bằng cành uốn cong, dây gai.
- **dock:** Bến gỗ có cột chạm hình thiên nga, thuyền lá cong.
- **towers:** Tháp là cây cao có chòi gác trên tán. Mỗi cấp cây to hơn, Ballista Tower có nỏ bằng gỗ sống.
- **wonder:** Cây Thế Giới khổng lồ, rễ ôm một hồ nước, các sàn bạc trên cành, chim trắng bay quanh.

## dwarf — Dwarf: núi và lò rèn

**Bản sắc:** đào vào núi, xây bằng đá tảng và đồng thau, lò rèn đỏ lửa suốt đêm. Hình khối vuông vức và nặng, cửa
vòm thấp và sâu, chữ rune khắc trên đá (kiểu Bắc Âu, cổng đá Hy Lạp cổ Mycenae).

- **vat-lieu:** Stone: lán đá chồng trên sườn đá. Tool: đá thô, mái phiến đá, gỗ dày. Bronze: đá đẽo vuông, nẹp đồng
  thau, rune khắc. Iron: đá granit đánh bóng, cột và mái viền đồng, đèn lò sáng ở mọi cửa.
- **town_center:** Cửa vào lòng núi giữa hai tượng thợ mỏ, đường ray xe goòng đi ra, đống quặng, ống khói lò. Iron: cổng
  đồng hai lớp, tháp canh đá hai bên.
- **house:** Nhà đá thấp dựa vào tảng đá lớn, ống khói, thùng bia, rìu treo.
- **granary:** Hầm chứa có cửa sập trên đất, thùng gỗ đai sắt, bao lúa mạch.
- **storage_pit:** Bãi quặng và đá tảng, cần trục gỗ, xe goòng, đống thỏi kim loại (Bronze: đồng, Iron: sắt).
- **barracks:** Sảnh đá có sân tập, giá rìu và búa, hình nộm bọc giáp.
- **archery_range:** Đường bắn trong rãnh đá, bia bằng khiên cũ, giá nỏ.
- **stable:** Chuồng dê núi lớn hoặc lợn rừng (chỉ là hình, Dwarf không có kỵ), máng đá.
- **market:** Sạp đá có đe, cân đồng thau, thỏi kim loại, đá quý.
- **temple:** Lò rèn thiêng có đe lớn, lửa không tắt, tượng thần thợ rèn (kiểu Hephaestus).
- **government_center:** Sảnh chúa núi: ngai đá trong hang, cột đá to, rune vàng.
- **academy:** Phòng kỹ sư có bản vẽ máy, mô hình bánh răng, ống khói.
- **siege_workshop:** Xưởng lớn có nỏ hạng nặng, bánh xe đai sắt, lò luyện.
- **dock:** Bến đá chắc chắn, thuyền gỗ đóng đinh đồng, cần trục.
- **towers:** Tháp đá vuông có lỗ châu mai. Mỗi cấp cao và dày hơn, có mái đồng ở Iron.
- **wonder:** Cổng núi khổng lồ khắc mặt vua Dwarf, thác dung nham chảy xuống, tượng thợ mỏ hai bên.

## centaur — Centaur: thảo nguyên và sao trời

**Bản sắc:** du mục, dựng trại rộng, sống dưới bầu trời. Lều vải tròn và nhà cột mở, cột cờ đuôi ngựa, bản đồ sao.
Không gian rộng, sân lớn, ít tường (kiểu lều yurt Mông Cổ, mộ gò Scythia, đền cột Hy Lạp).

- **vat-lieu:** Stone: lều da trên khung gỗ. Tool: lều vải kem, cột gỗ. Bronze: vải có hoa văn sao, cột gỗ sơn, thảm.
  Iron: đá trắng có khắc chòm sao, mái vải căng trên cột đá, đồ đồng thau.
- **town_center:** Lều lớn ở giữa trại, xung quanh là lều nhỏ, cột cờ đuôi ngựa, lửa trại, xe chở đồ. Iron: đài đá tròn
  có mái vải căng, đồng hồ mặt trời.
- **house:** Lều tròn (yurt) có cửa gỗ chạm, thảm phơi, thùng nước.
- **granary:** Lều kho có bao ngũ cốc, giỏ, cỏ khô.
- **storage_pit:** Bãi để đồ, xe kéo, đống da, gỗ súc buộc dây.
- **barracks:** Sân tập giáo quanh vòng tròn, giá giáo dài, hình nộm cưỡi ngựa.
- **archery_range:** Đường bắn dài để vừa chạy vừa bắn, bia trên cột cao, cột chạy vòng.
- **stable:** Bãi quây rộng, máng nước, giá yên, đồng cỏ (chỗ centaur nghỉ).
- **market:** Chợ phiên lều nhiều màu, thảm treo, hũ gốm, cân.
- **temple:** Đài thiên văn: vòng cột đá ngắm sao, quả cầu sao bằng đồng.
- **government_center:** Lều hội đồng lớn có vòng ghế, các cột cờ của các bộ lạc.
- **academy:** Đài quan sát có ống ngắm sao bằng đồng, bản đồ sao trên vải.
- **siege_workshop:** Lán vải lớn, xe bắn đá có bánh to để kéo theo đoàn.
- **dock:** Bến gỗ đơn giản, thuyền da căng trên khung.
- **towers:** Tháp gỗ cao có chòi canh vải, kiểu tháp ngắm sao. Iron: tháp đá có vòm đồng.
- **wonder:** Đài Sao: vòng cột đá khổng lồ, bàn thờ có quả cầu sao lớn, vòm trời bằng đồng thau có lỗ sao.

## beastfolk — Beastfolk: bộ lạc thú

**Bản sắc:** săn bắn và chiến đấu, sống theo bộ lạc. Xây bằng da, xương, gỗ thô và đất. Cột vật tổ hình đầu thú, dấu
vẽ đỏ son, hàng rào xương (lều da, nhà dài kiểu Bắc Âu, cột vật tổ châu Mỹ, tranh hang động).

- **vat-lieu:** Stone: lều da trên khung xương. Tool: nhà dài vách đất mái rơm, hàng rào cọc. Bronze: gỗ chạm hình thú,
  vẽ son đỏ, sừng trên mái. Iron: cột đá dựng (menhir), đầu lâu thú lớn, đồ đồng thô.
- **town_center:** Nhà dài lớn có đầu sói chạm trên mái, cột vật tổ cao, lửa trại, giá phơi thịt, da thú căng. Iron:
  vòng đá dựng quanh sân, đầu lâu voi ma mút ở cổng.
- **house:** Lều da hoặc nhà đất nửa chìm, sừng treo cửa, đống xương.
- **granary:** Giàn phơi thịt và quả, hố chứa có nắp da.
- **storage_pit:** Bãi da, xương, gỗ thô, khối đá vụn.
- **barracks:** Hố đấu vật quây xương, giá chùy và rìu đá, cột vật tổ chiến binh.
- **archery_range:** Bia là xác thú nhồi rơm, giá lao.
- **stable:** Chuồng sói lớn (thay ngựa, chỉ là hình), xương gặm, cột buộc.
- **market:** Chỗ đổi chác: da, nanh, vỏ ốc, lửa trại.
- **temple:** Hang thần thú: cửa hang có đầu lâu lớn, tranh vẽ trên vách, lửa thiêng.
- **government_center:** Ngai xương của tù trưởng dưới mái da, các cột vật tổ của từng thị tộc.
- **academy:** Nơi thầy cúng dạy: lều có tranh vẽ, trống da, vòng đá.
- **siege_workshop:** Bãi có máy bắn đá bằng gỗ thô buộc dây gân, cây gỗ phá cổng.
- **dock:** Bến cọc gỗ, thuyền độc mộc, lưới.
- **towers:** Tháp gỗ thô có đầu lâu trên đỉnh. Iron: tháp đá dựng.
- **wonder:** Gò đầu lâu khổng lồ (đã có), thêm vòng đá dựng, lửa lớn, cột vật tổ cao nhất bản đồ.

## units — Dân làng và lính

- **dan-lang:** Giữ thân hình và trang phục đã có, theo ý chủ repo. Chỉ thêm đồ mang theo của từng tộc để dễ nhận ra ở
  cỡ nhỏ:
  - Elf: túi lá, cung nhỏ sau lưng;
  - Dwarf: mũ có đèn thợ mỏ;
  - Centaur: giỏ hai bên lưng ngựa;
  - Beastfolk: dây nanh thú ở cổ.
- **linh-chung:** Elf đã có 15 loại lính chung mặc đồ riêng (#127). Làm tương tự cho 3 tộc còn lại:
  - Dwarf: giáp tấm, mũ sừng, râu;
  - Centaur: lính bộ thành centaur cầm vũ khí tương ứng;
  - Beastfolk: lính đầu sói hoặc gấu như các lính riêng hiện có.
- **linh-rieng:** Rà lại 8 lính riêng cho rõ dáng ở cỡ nhỏ:
  - Glade Archer: áo choàng xanh, cung dài;
  - Grove Warden: người cây, cao gấp rưỡi lính thường;
  - Ironclad: giáp tấm, khiên to;
  - Deep Arbalest: nỏ lớn;
  - Centaur Archer: cung ngắn trên lưng ngựa;
  - Hoof Lancer: giáo dài;
  - Wolfkin Raider: đầu sói, hai rìu;
  - Bearkin Brute: thân gấu, chùy đá.

## icons — Biểu tượng nút

- **icon-cong-trinh, icon-dan:** Đã làm ở #131: nút xây, nút sinh dân và chân dung dùng hình của tộc. Khi vẽ lại công
  trình theo kế hoạch này, biểu tượng tự đổi theo.
- **icon-tech:** Công nghệ riêng (Moonlit Volley, Galloping Volley, Blood of the Wild...) có biểu tượng riêng.

## hud — Khung giao diện theo tộc

- **khung:** Thanh dưới và thanh tài nguyên đổi chất liệu theo tộc người chơi đang chơi:
  - Elf: gỗ ngà có dây leo;
  - Dwarf: đá xám có đinh tán đồng;
  - Centaur: da thuộc có đường chỉ khâu;
  - Beastfolk: da thú có nanh và xương ở góc.

  Dân tộc người giữ khung hiện tại.
- **nut:** Viền nút cùng chất liệu với khung, nút được gợi ý (#140) vẫn có viền vàng.
- **tai-nguyen:** Thanh tài nguyên giữ 4 biểu tượng chung để không gây nhầm, chỉ đổi nền.
- **man-chon:** Màn hình chọn dân tộc có ảnh nhỏ của Town Center và một dân làng cho mỗi tộc giả tưởng.

## fx — Hiệu ứng và âm thanh (tùy chọn, làm sau)

- **chay-nha:** Lửa khi công trình bị đánh theo vật liệu: Elf lá cháy và tàn đỏ, Dwarf khói đen, Centaur vải cháy
  bay, Beastfolk da cháy khói nâu.
- **am-thanh:** Tiếng chọn công trình và tiếng hô của lính theo tộc: chim và gió lá, tiếng búa đe, tiếng vó và tù và,
  tiếng hú sói.

## Thứ tự làm đề xuất

1. `all` (căn giữa, nền đất, đồ vật) và `icon-tech`. Phần này người chơi thấy rõ nhất và ít rủi ro nhất.
2. Công trình của từng tộc, mỗi tộc một PR, so bằng `art3d/compare.py` trước và sau.
3. `units`: lính chung cho Dwarf, Centaur, Beastfolk là việc lớn nhất (khoảng 45 hình động).
4. `hud`.
5. `fx`.

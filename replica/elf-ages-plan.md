# Đề xuất: Elf thay đổi theo từng đời (dân, lính, công trình)

**Trạng thái:** đề xuất, chờ chủ repo duyệt (viết ngày 2026-10-17).

Mỗi mục có mã in đậm. Ghi "Duyệt", "Sửa: ..." hoặc "Bỏ" ngay sau mục, hoặc sửa thẳng file này. Phần này đi tiếp
[fantasy-art-plan.md](fantasy-art-plan.md), làm cho Elf trước, sau đó áp cùng cách cho Dwarf, Centaur, Beastfolk.

## Hiện trạng và vấn đề

- **Dân làng:** một kiểu duy nhất cho cả 4 đời (bikini da gấu, tóc vàng, tai nhọn, theo ý chủ repo). Lên Iron Age
  vẫn trông như thời Đồ Đá.
- **Lính:** 15 lính chung mặc đồ Elf (#127) và 2 lính riêng. Lính đời sau khác lính đời trước chủ yếu ở vũ khí; vật
  liệu và màu gần như giống nhau, nên đội quân Iron không trông "giàu" hơn đội quân Tool.
- **Công trình** (#145, bản đầu): mỗi đời chỉ thêm một hai thứ (một chòi, vòm bạc ở Iron). Cùng vật liệu gỗ ngà và
  mái lá ở mọi đời, nên nhìn từ xa không biết người chơi đang ở đời nào. Trong AoE gốc, lên đời là thấy ngay cả
  thành phố đổi mặt.
- **Bộ máy:** game chỉ có một hình cho mỗi loại lính hoặc dân (`elf/villager`), không theo đời. Công trình thì đã có
  hình theo đời.

## all — Nguyên tắc chung

- **thang-vat-lieu:** Mỗi đời Elf có một bộ vật liệu và một màu chủ đạo. Dân, lính và công trình cùng đổi một lúc, để
  lên đời là thấy cả thành phố đổi màu.

  | Đời | Vật liệu | Màu chủ đạo | Ánh sáng |
  |---|---|---|---|
  | Đồ Đá | Da gấu, gỗ thô, lá tươi, đá cuội | Nâu và xanh lá đậm | Lửa trại nhỏ |
  | Tool | Da thuộc, gỗ sống uốn cong, dây leo, lông vũ | Nâu đỏ, xanh lá tươi | Đom đóm |
  | Bronze | Vỏ cây trắng (bạch dương), lụa lá, đồng xanh rỉ, đá trắng khắc hoa văn | Trắng ngà, xanh ngọc | Nấm phát sáng xanh |
  | Iron | Bạc, đá mặt trăng, kính lá màu, gỗ trắng đánh bóng | Trắng bạc, xanh nhạt, ánh vàng | Đá mặt trăng sáng ở mọi cửa |

- **dang-hinh:** Đời càng cao thì dáng càng cao, mảnh và nhiều đường cong (kiểu Art Nouveau): mái từ tròn thấp lên
  vòm nhọn cao, cột thẳng thành thân cây xoắn, hoa văn dây leo nhiều dần.
- **bo-may-theo-doi:** Cho phép hình dân và lính theo đời, thêm khóa `elf/villager@bronze` trong `manifest.json`.
  Không có thì lùi về đời trước, rồi về hình chung. Cùng cách game đang làm với công trình
  (`assetBuildingSpec`). Việc nhỏ, khoảng nửa ngày, dùng chung cho cả 4 tộc.
- **giu-y-chu-repo:** Giữ nét chính đã chọn: thân hình, tóc vàng, tai nhọn, phong cách anime, và nền bikini da gấu.
  Các đời sau khoác thêm lớp lên trên, không che nhiều hơn mức hiện có ở thân giữa (vẫn "không lộ hơn đồ bơi").

## villager — Dân làng

- **dan-da:** Đồ Đá (như hiện nay): bikini da gấu, băng trán màu phe, chân trần, dụng cụ đá và gỗ.
- **dan-tool:** Tool: thêm khăn choàng da thuộc ngang hông, vòng tay dây leo, dép da buộc dây, túi da đeo chéo. Dụng
  cụ có lưỡi đá mài và cán gỗ uốn.
- **dan-bronze:** Bronze: áo choàng ngắn lụa lá xanh ngọc khoác ngoài (để hở như hiện tại), vòng cổ đồng xanh, tóc tết
  có lá, đai lưng thêu hoa văn. Dụng cụ lưỡi đồng hình lá.
- **dan-iron:** Iron: áo choàng trắng viền bạc, vương miện lá bạc nhỏ, giày cao cổ da trắng, mặt dây đá mặt trăng phát
  sáng nhẹ. Dụng cụ lưỡi bạc.
- **dan-nghe:** Mỗi nghề vẫn có đồ riêng qua 4 đời: thợ rìu có túi gỗ sau lưng, thợ mỏ có đèn đá mặt trăng ở trán
  (Bronze, Iron), người hái có giỏ đan cành, ngư dân có cần câu bằng cành liễu. Vật cầm tay lên đời theo cùng thang
  vật liệu.

## soldiers — Quân phục

Lính trong cùng một dòng lên đời thì mặc đồ của đời đó: Clubman là đồ Đá, Short Swordsman là Bronze, Long Swordsman là
Iron. Vũ khí và giáp lấy theo thang vật liệu.

- **bo-binh:** Bộ binh (Barracks):
  - Clubman (Đồ Đá): da gấu, gậy gỗ có gai.
  - Axeman (Tool): khiên đan cành, rìu đá có cán uốn.
  - Short Swordsman (Bronze): giáp vảy lá đồng xanh, kiếm lá, khiên tròn gỗ trắng.
  - Broad Swordsman (Bronze, sau nâng cấp): giáp vảy kín hơn, mũ có lông vũ.
  - Long Swordsman (Iron): giáp bạc chạm hoa văn, kiếm cong dài, áo choàng trắng, mũ có cánh lá.
- **cung-thu:** Cung thủ (Archery Range):
  - Bowman (Tool): da thuộc, cung gỗ đơn.
  - Improved Bowman (Bronze): áo lụa lá, cung uốn hai đầu, ống tên thêu.
  - Glade Archer (riêng, Bronze): áo choàng mũ trùm xanh rêu, cung dài cao bằng người.
  - Iron, sau Moonlit Volley: đầu mũi tên phát sáng xanh nhạt khi bắn.
- **giao-binh:** Hoplite (Bronze) và Phalanx (Iron) ở Academy: khiên tròn lớn gỗ trắng có hình cây, giáo lá dài. Phalanx
  có giáp bạc và khiên viền bạc.
- **ky-binh:** Kỵ binh cưỡi **nai sừng lớn** thay ngựa, khớp với chuồng ở Stable:
  - Scout (Tool): nai không yên, người cưỡi mặc da.
  - Cavalry (Bronze): nai có yên lụa, sừng gắn chuông đồng.
  - Horse Archer, Heavy Horse Archer (Iron): nai trắng, yên bạc, người cưỡi áo choàng trắng.

  Chỉ đổi hình, chỉ số giữ nguyên. Cần ghi chú trong game để người chơi không nhầm là đơn vị mới.
- **thay-tu:** Priest (Bronze): áo dài trắng, gậy cành có đá mặt trăng sáng. Iron, sau các công nghệ ở Temple: thêm
  vòng lá bạc quanh đầu.
- **nguoi-cay:** Grove Warden (Iron): cao gấp rưỡi lính thường. Tán lá đổi màu theo mùa ngẫu nhiên (xanh, vàng, đỏ)
  cho mỗi con, để một nhóm trông như khu rừng biết đi. Rễ kéo lê khi đi.
- **may-cong-thanh:** Máy công thành bằng gỗ sống:
  - Stone Thrower (Bronze): cành uốn cong làm cần ném, đá bọc lá.
  - Catapult (Iron): thân gỗ trắng, dây bạc.
  - Ballista (Iron): nỏ lớn hình con thiên nga.
- **thuyen:** Thuyền hình lá:
  - Fishing Boat, Fishing Ship: thân lá cong, buồm lá.
  - War Galley, Trireme: thân gỗ trắng, mũi chạm thiên nga, buồm lụa xanh ngọc, Iron có viền bạc.
  - Transport: thuyền tròn đan cành.
- **nang-cap-giap:** Tùy chọn, làm sau: khi nghiên cứu giáp ở Storage Pit (Leather/Scale/Chain Armor), lính có thêm
  một miếng giáp nhìn thấy được (vai, ngực). Giúp người chơi biết đối thủ đã nâng cấp. AoE gốc không có điều này.

## buildings — Công trình

Mỗi đời một bậc rõ rệt. Đồ Đá là chòi lá trên gốc cây. Tool là nhà gỗ sống mái lá. Bronze là gỗ trắng và đá khắc có
vòm. Iron là thành phố trên cây, có bạc, kính lá và đèn.

- **town_center:**
  - Đồ Đá: gốc cây lớn có chòi lá, lửa trại.
  - Tool: cây cổ thụ có một sàn gỗ và cầu thang quanh thân, chòi trong rễ.
  - Bronze: cây to hơn, hai sàn, mái vòm lá trên sàn, đèn nấm, suối nhỏ lát đá trắng.
  - Iron: thân cây bọc bạc ở gốc, ba sàn có lan can chạm, vòm kính lá, cầu treo sang hai cây nhỏ, hồ nước có đá mặt
    trăng.
- **house:**
  - Đồ Đá: chòi lá.
  - Tool: nhà tròn trong gốc cây, thang dây.
  - Bronze: nhà trên cành thấp, vòm lá có cửa sổ tròn.
  - Iron: nhà gỗ trắng hai tầng quấn quanh thân cây, cửa sổ kính lá, đèn đá.
- **granary:**
  - Đồ Đá: giỏ treo trên cành.
  - Tool: kho đan treo dưới tán.
  - Bronze: kho tròn gỗ trắng trên chân cây.
  - Iron: tháp kho có mái vòm bạc, ròng rọc kéo giỏ.
- **storage_pit:**
  - Đồ Đá: gỗ đổ xếp đống.
  - Tool: lán lá, bàn chạm.
  - Bronze: lán gỗ trắng có cột thân cây xoắn.
  - Iron: xưởng mộc có mái kính lá, cung đang làm treo trên giá bạc.
- **barracks:**
  - Đồ Đá: bãi tập giữa các cây.
  - Tool: cổng cành uốn.
  - Bronze: sảnh gỗ trắng có hàng cột thân cây.
  - Iron: sảnh cao có mái vòm nhọn, khiên bạc treo.
- **archery_range:**
  - Đồ Đá, Tool: bia khoanh gỗ giữa hai hàng cây.
  - Bronze: thêm tượng nữ thần săn bằng gỗ.
  - Iron: tượng bằng đá trắng có cung bạc, đường bắn lát đá, đèn ở mỗi bia.
- **stable:**
  - Tool: chuồng nai bằng cành.
  - Bronze: chuồng gỗ trắng có máng đá.
  - Iron: chuồng có mái vòm, nai trắng.
- **market:**
  - Tool: sạp dưới tán.
  - Bronze: lều lụa xanh ngọc.
  - Iron: chợ có mái kính lá, đèn treo, đài phun nước nhỏ.
- **temple:**
  - Bronze: vòng đá trắng quanh cây thiêng, giếng ánh trăng.
  - Iron: vòng đá thành vòng cột bạc, cây thiêng có lá bạc, giếng sáng mạnh hơn.
- **government_center:**
  - Bronze: sàn hội đồng quanh cây, ghế đá.
  - Iron: sảnh có mái vòm bạc, ngai gỗ trắng.
- **academy:**
  - Bronze: thư viện trong thân cây.
  - Iron: tháp thư viện có cửa sổ kính lá và ban công.
- **siege_workshop:** Iron: xưởng có cần trục cành uốn, máy bắn đá đang làm, gỗ trắng.
- **dock:**
  - Tool: bến gỗ.
  - Bronze: bến có cột chạm thiên nga.
  - Iron: bến đá trắng, đèn, thuyền lá buộc bên.
- **towers:** Tháp là cây cao có chòi:
  - Watch Tower: chòi lá.
  - Sentry Tower: chòi gỗ có mái.
  - Guard Tower: chòi gỗ trắng có vòm.
  - Ballista Tower: tháp bạc có nỏ thiên nga.
- **wonder:** Cây Thế Giới:
  - Bronze: cây khổng lồ có các sàn gỗ, hồ nước dưới rễ.
  - Iron: các sàn bạc, vòm kính lá trên đỉnh, thác nước chảy từ rễ, chim trắng, đèn khắp nơi.

## Thứ tự làm đề xuất

1. `bo-may-theo-doi`: hình dân và lính theo đời. Nhỏ, cần trước mọi thứ khác.
2. `buildings`: công trình Elf theo thang 4 đời. Người chơi thấy rõ nhất, không cần sửa bộ máy.
3. `villager`: dân làng 4 đời × 10 nghề, khoảng 40 hình động.
4. `soldiers`: lính theo dòng, khoảng 20 hình động, kể cả kỵ binh cưỡi nai.
5. Tùy chọn: `nang-cap-giap`.

Mỗi bước một PR, kèm trang so sánh (`web/scripts/race-review.mjs`) để duyệt hình trước khi merge.

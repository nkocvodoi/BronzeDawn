# Kế hoạch sửa hình công trình (đề xuất, chờ duyệt)

Viết ngày 2026-10-16 sau khi xem cả 235 cặp hình của `art3d/compare.py`: 19 loại công trình, 5 kiến trúc (Ai Cập,
Babylon, Châu Á, Hy Lạp, La Mã), mọi thời đại, đặt cạnh bản gốc. Điểm lúc viết: 65/100 (60 trước đợt vân vật liệu).
Đã gộp 20 góp ý đầu tiên của chủ repo (`art-review.json`).

Mỗi mục bên dưới là một việc. Duyệt trên trang `art3d/plan_page.py` (mỗi mục có ô Duyệt / Sửa / Bỏ và ô ghi), hoặc
sửa thẳng file này. Thiết kế lấy từ kiến trúc cổ có thật (tên gọi trong ngoặc), không chép hình của bản gốc: bản gốc
chỉ dùng để so phong cách và mức chi tiết.

## all — Quy tắc chung (áp cho mọi công trình)

- **nen-dat:** Nền đất màu đất thật, có mảng rêu và cỏ mọc lốm đốm, vệt đường mòn; bỏ nền sáng phẳng trông như bê
  tông. Chỉ lát đá ở nơi có lý do (quảng trường, đền), và có cỏ mọc ở khe đá. (Góp ý của chủ repo, 20/20 mẫu.)
- **chi-tiet:** Mỗi công trình có một lớp đồ vật: 10–20 vật nhỏ cho công trình 2–3 ô, 25–40 cho công trình lớn (vò,
  bao, thùng, củi, dụng cụ, chậu cây, cỏ, đá vụn). Chúng nằm ở mép sân và cạnh cửa để không che công trình.
- **quan-the:** Công trình là một khu nhiều phần (nhà chính, sân, nhà phụ, tường bao), không phải một khối hộp. Áp cho
  Town Center, Barracks, Stable, Storage Pit, Siege Workshop, Academy, Government Center.
- **thoi-dai:** Mỗi đời lên một bậc vật liệu và trang trí. Tool: gạch bùn, gỗ, rơm. Bronze: gạch nung, trát vôi, viền
  màu. Iron: đá đẽo sáng màu, cẩm thạch, cột, tượng, mạ vàng. Tường Iron sáng hơn Bronze để thấy được nâng cấp. (Góp ý
  Archery Babylon Iron.)
- **co:** Nhà và Granary đang to hơn bản gốc 1,3–1,5 lần: thu nhỏ khoảng 25% trong khung ô. Công trình khác giữ cỡ.
- **mau-phe:** Màu phe chỉ ở cờ, băng rôn, viền mái, khiên treo; không quá khoảng 5% hình (đang đúng ở công trình).
- **cong-babylon:** Bỏ cổng gạch men xanh hình sư tử ở mọi công trình Babylon (Academy, Town Center, Temple, Government
  Center, Wonder). Dải men xanh trên tường vẫn giữ làm dấu hiệu của kiến trúc. (Góp ý Academy Babylon.)
- **cat-mep:** Sửa 4 hình bị cắt mép có từ #141: Wonder châu Á Bronze/Iron (đỉnh), Government Center La Mã Bronze/Iron
  (bên phải).

## town_center — Town Center

- **chung:** Một khu có sân trước: nhà chính, giếng hoặc hồ nước, kho nhỏ, đống củi, cột cờ. Stone (chung mọi kiến trúc):
  giữ chòi lớn, thêm hàng rào cọc, lửa trại, giá phơi da, chum.
- **egyptian:** Tool: nhà gạch bùn mái bằng, có cầu thang lên mái, sân có giếng, cây chà là. Bronze: sân có hồ nước chữ
  nhật, hàng cột hoa sen trước nhà, tượng nhân sư nhỏ. Iron: nhà đá trắng có cổng hai tháp thuôn, hồ nước, đôi obelisk.
- **babylonian:** Tool: nhà gạch bùn có tháp vuông góc. Bronze: sân giữa có bậc thềm cao kiểu ziggurat nhỏ. Iron: cung
  điện tường sáng có dải men xanh (không cổng sư tử), vườn trên mái thấp, cây cọ trong sân.
- **asian:** Tool: nhà gỗ mái rơm cong, sân đất có giếng. Bronze: điện mái ngói cong hai tầng, sân có lư hương đá.
  Iron: điện ba tầng mái trên nền đá, ao sen, cổng nhỏ ba lối (tam quan).
- **greek:** Tool: nhà đá mái ngói, sân có giếng. Bronze: nhà có sân cột (peristyle) và đài phun nước nhỏ. Iron: tòa
  hội đồng (prytaneion) có hiên cột, bếp lửa thiêng ở sân, tượng, cây bách.
- **roman:** Tool: nhà đá mái ngói. Bronze: nhà có vòm cửa (basilica nhỏ) và sân. Iron: quảng trường (forum) có hàng
  cột, tượng cưỡi ngựa trên bệ, đài phun nước.

## house — House

- **chung:** Nhỏ lại khoảng 25%. Thêm sân nhỏ, vò, giỏ, chậu cây, dây phơi vải, đống củi.
- **egyptian:** Tool: nhà gạch bùn mái bằng, có thang lên mái. Bronze: thêm hiên cột gỗ nhỏ, viền sơn xanh. Iron: nhà
  hai tầng có sân trong, cây chà là.
- **babylonian:** Tool: nhà sậy mái vòm (mudhif). Bronze: nhà gạch bùn mái bằng có tường sân. Iron: nhà gạch nung có
  dải men xanh và sân trong. (Ba đời đang giống nhau.)
- **asian:** Tool: nhà sàn tre mái rơm. Bronze: nhà gỗ mái ngói, hàng rào tre. Iron: nhà hai tầng mái cong, sân có
  chum nước.
- **greek:** Tool: nhà đá vụn mái rơm. Bronze: nhà mái ngói có sân nhỏ. Iron: nhà có hiên cột, sân trong có giếng.
- **roman:** Tool: nhà đá mái rơm. Bronze: nhà mái ngói đỏ, cửa vòm. Iron: nhà có sân trong mở mái (atrium), bồn hoa.

## granary — Granary

- **chung:** Nhỏ lại khoảng 25%. Sân phơi lúa, bao lúa, xe kéo, thúng, cối xay tay.
- **egyptian:** Silo gạch bùn hình tổ ong có thang lên đỉnh; Iron: dãy silo trên nền đá, sân phơi lát đá.
- **babylonian:** Silo vòm gạch bùn trên nền cao; Iron: kho gạch nung có dải men xanh.
- **asian:** Kho lúa sàn cao trên cột gỗ (chống chuột), mái rơm rồi mái ngói; Iron: kho tròn nhiều tầng mái.
- **greek:** Nhà kho đá và hàng chum lớn (pithoi) chôn nửa dưới đất; Iron: kho có hiên cột.
- **roman:** Kho dài có sân giữa (horreum), xe chở bao trước cổng.

## storage_pit — Storage Pit

- **chung:** Là bãi chứa ngoài trời, không phải nhà kín: đống gỗ súc, khối đá đẽo, đống quặng vàng, da thú căng phơi,
  một lán che. Bronze/Iron: sân có tường thấp, cần trục gỗ.
- **egyptian:** Lán mái chiếu sậy trên cột; Iron: sân lát đá, lán mái bằng trên cột hoa sen.
- **babylonian:** Lán gạch bùn; Iron: tường sáng có dải men.
- **asian:** Lán mái ngói cong trên cột gỗ đỏ.
- **greek:** Lán mái ngói trên cột đá.
- **roman:** Lán mái ngói, cửa vòm, xe bò chở đá.

## barracks — Barracks

- **chung:** Doanh trại có sân tập: tường bao, nhà ở, giá vũ khí, hình nộm tập, khiên treo, bia ném lao. Không phải một
  hộp.
- **egyptian:** Tool: sân rào gạch bùn và nhà. Bronze: tường thuôn, tháp góc thấp. Iron: tường đá trắng, cổng hai tháp,
  cột hoa sen.
- **babylonian:** Tường răng cưa, sân có giếng; Iron: tường sáng và dải men xanh.
- **asian:** Nhà dài mái cong quanh sân, giá giáo; Iron: cổng có mái hai tầng.
- **greek:** Nhà quanh sân tập cát (palaestra); Iron: hiên cột quanh sân.
- **roman:** Trại lính vuông (castra): tường, cổng giữa, dãy nhà, cờ hiệu.

## dock — Dock

- **chung:** Nhỏ lại (đang to và cả 5 kiến trúc giống nhau). Cầu tàu gỗ trên cọc, lưới phơi, giỏ cá, thuyền nhỏ buộc
  bên, mái theo kiến trúc.
- **egyptian:** Bến đá có cột hoa sen, thuyền sậy; Iron: bến đá trắng.
- **babylonian:** Bến gạch có dải men, thuyền tròn đan (quffa).
- **asian:** Nhà thủy tạ mái cong trên cọc, đèn lồng.
- **greek:** Bến đá có hiên cột, chum.
- **roman:** Bến đá có vòm, cần trục gỗ.

## archery_range — Archery Range

- **chung:** Nền đất có rêu (như quy tắc chung). Giữ tường bao, bia, chỗ đứng bắn.
- **egyptian:** Thay nhà kho ở giữa bằng tượng nữ thần săn bắn và chiến tranh cầm cung trên bệ (kiểu Neith). (Góp ý.)
- **babylonian:** Iron: tường sáng màu hơn để thấy vật liệu được nâng cấp. (Góp ý.)
- **asian:** Tool/Bronze: lán vải che chỗ đứng bắn. Iron: lán mái ngói cong. (Góp ý.)
- **greek:** Tượng nữ thần săn bắn cầm cung (kiểu Artemis) thay nhà kho ở giữa. (Góp ý ghi ở mẫu Greek Tool giống mẫu
  Ai Cập, tôi hiểu là cũng muốn tượng; sửa nếu không đúng.)
- **roman:** Iron: cổng vòm đá.

## stable — Stable

- **chung:** Chuồng ngựa và bãi quây hàng rào, máng nước, đống cỏ khô, yên cương treo, một con ngựa buộc. Iron: tường đá,
  sân lát.
- **egyptian:** Chuồng mái chiếu sậy, cây chà là.
- **babylonian:** Chuồng gạch bùn có răng cưa.
- **asian:** Chuồng gỗ mái cong.
- **greek:** Chuồng đá mái ngói.
- **roman:** Chuồng đá có vòm cửa.

## market — Market

- **chung:** Iron đã làm (đình tròn cho Hy Lạp, La Mã; chợ riêng cho Châu Á, Ai Cập, Babylon).
- **egyptian:** Bronze: chợ chiếu sậy và cây chà là như bản Iron, đơn giản hơn.
- **babylonian:** Bronze: lều vải dài, đồ gốm, cây cọ.
- **asian:** Bronze: sạp mái tranh cong, dù tròn.

## farm — Farm

- **chung:** Luống cây thật thay cho sọc vàng phẳng: mầm xanh rồi vàng chín, bờ đất. Góc ruộng có chòi nhỏ hoặc bù
  nhìn. Ruộng hiện giống nhau cho mọi kiến trúc.
- **egyptian:** Kênh tưới chạy cạnh ruộng.
- **asian:** Ruộng lúa nước: bờ ruộng, mặt nước, mạ.

## towers — Watch, Sentry, Guard, Ballista Tower

- **chung:** Mỗi kiến trúc một kiểu tháp (đang dùng chung một tháp tròn). Mỗi cấp cao và to hơn, vật liệu tốt hơn.
  Ballista Tower có nỏ lớn trên đỉnh.
- **egyptian:** Tháp thuôn kiểu pylon, gạch bùn rồi đá.
- **babylonian:** Tháp gạch có răng cưa và dải men.
- **asian:** Tháp gỗ nhiều tầng mái cong.
- **greek:** Tháp đá tròn có mái hình nón.
- **roman:** Tháp vuông đá có cửa vòm.

## government_center — Government Center

- **chung:** Thêm bậc thềm, tượng, vườn, cột cờ. Babylon bỏ cổng sư tử.
- **egyptian:** Cung có hàng cột hoa sen, tượng ngồi hai bên lối vào.
- **babylonian:** Cung có sân trong, dải men, cây cọ.
- **asian:** Điện hai tầng mái trên bậc đá.
- **greek:** Hội trường bậc ghế (bouleuterion) có hiên cột.
- **roman:** Viện nguyên lão (curia) mái ngói và quảng trường nhỏ.

## temple — Temple

- **egyptian:** Đền có cổng hai tháp, hàng cột hoa sen, hai hàng tượng nhân sư dọc lối vào.
- **babylonian:** Ziggurat: bỏ cổng xanh, thêm cầu thang lớn lên đỉnh và đền nhỏ trên đỉnh.
- **asian:** Giữ chùa nhiều tầng, thêm ao và cầu, đèn đá.
- **greek:** Giữ đền cột, thêm bàn thờ lửa trước đền, cây bách.
- **roman:** Đền mái vòm: hiên cột rõ hơn, quảng trường lát đá có cỏ ở khe.

## academy — Academy

- **chung:** Nền đất có rêu. (Góp ý.)
- **egyptian:** Sân có hàng cột và tượng.
- **babylonian:** Bỏ cổng xanh. (Góp ý.)
- **asian:** Sân tập võ, giá binh khí.
- **greek:** Đài phun nước giữa sân. (Góp ý.)
- **roman:** Bậc thềm lên nhà, hình nộm tập kiếm trong sân. (Góp ý.)

## siege_workshop — Siege Workshop

- **chung:** Xưởng có sân: máy bắn đá đóng dở, đống gỗ súc, cần trục, búa, đá tròn. Không phải một hộp.

## wonder — Wonder

- **egyptian:** Kim tự tháp: các lớp khối đá thấy rõ, đền nhỏ ở chân, lối đi có obelisk.
- **babylonian:** Ziggurat: bỏ cổng xanh, thêm vườn trên các tầng.
- **asian:** Tháp chùa: thêm sân đá và tường thấp quanh.
- **greek:** Đền lớn trên bệ: thêm tượng và bậc thềm.
- **roman:** Đấu trường: tầng vòm rõ hơn, cờ trên đỉnh.

## order — Thứ tự làm

- **dot-1:** Quy tắc chung (nền đất, đồ vật, cỡ, bỏ cổng Babylon, sửa cắt mép), rồi render lại và gửi trang duyệt.
- **dot-2:** Các quần thể: Town Center, Barracks, Stable, Storage Pit, Siege Workshop.
- **dot-3:** Riêng từng kiến trúc: tháp, Dock, Farm.
- **dot-4:** Nhà và Granary theo từng đời.
- **dot-5:** Temple, Government Center, Academy, Wonder, Market Bronze, Archery theo góp ý.

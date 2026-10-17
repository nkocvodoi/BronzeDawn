# Dwarf, Centaur, Beastfolk thay đổi theo từng đời

**Trạng thái:** làm theo yêu cầu của chủ repo ngày 2026-10-17: "làm tương tự [Elf] cho các tộc kia". Cách làm giống
[elf-ages-plan.md](elf-ages-plan.md):
- công trình đổi vật liệu và hình khối qua 4 đời;
- dân làng khoác thêm một lớp mỗi đời;
- lính chung của mỗi tộc mặc đồ của đời mà loại lính đó xuất hiện.

Hình đều tự dựng trong `art3d/` (`race_buildings.py`, `races.py`).

## Thang vật liệu

| Đời | Dwarf | Centaur | Beastfolk |
|---|---|---|---|
| Đồ Đá | Đá chồng tựa vách núi, cửa che da | Lều da trên cọc | Da căng trên khung xương |
| Tool | Đá hộc, gỗ, mái phiến đá, đai sắt | Lều vải kem, cọc gỗ | Nhà dài vách đất, mái rơm, sừng ở hồi nhà |
| Bronze | Đá xếp khối có mạch, trụ đá sẫm, đai đồng, rune | Vải có dải sao vàng, cọc sơn xanh, thảm | Gỗ chạm đầu thú ở hồi nhà và cửa, cột sơn son, cột vật tổ có mặt thú |
| Iron | Granite sẫm bóng, mái bậc thang viền vàng, rune và cửa sổ rực lửa lò | Bệ đá trắng, vải căng, chóp vàng trên mọi cọc, cột đá có đầu vàng | Chân tường đá dựng, đầu thú bằng đồng, đầu lâu, gạch đất nung |

## Dân phục (mỗi đời khoác thêm một lớp)

| Đời | Dwarf | Centaur | Beastfolk (tai và đuôi mèo) |
|---|---|---|---|
| Tool | Tạp dề da, bao tay sắt, ủng da | Chăn nâu trên lưng ngựa, túi yên, áo da | Áo da, quấn chân |
| Bronze | Áo lưới sắt, mũ đồng, đai đồng | Chăn xanh có sao vàng, vòng tay đồng, băng đầu có sao | Vòng cổ nanh, vạch sơn son, lông vũ trên đầu |
| Iron | Giáp ngực thép đai vàng, mũ viền vàng có đèn thợ mỏ | Áo phủ ngựa trắng viền vàng, giáp ngực và vòng đầu vàng | Vòng tay đồng, áo choàng lông sẫm, vòng đầu nanh đồng |

## Lính

- **Dwarf:** 13 loại lính chung, thân Dwarf (thấp, râu tết). Scout cưỡi ngựa xám.
- **Centaur:** 14 loại lính chung, tất cả là centaur. Kể cả kỵ binh, vì centaur không cưỡi ngựa. Ngựa trắng ở đời Iron.
- **Beastfolk:** 17 loại lính chung. Bộ binh và cung thủ là người sói. Bộ binh nặng (Long Swordsman, Phalanx,
  Centurion) là người gấu. Kỵ binh là người sói cưỡi ngựa xám.

Mỗi loại lính mặc đồ của đời mà nó xuất hiện. Ví dụ Clubman mặc đồ Đồ Đá, Short Swordsman mặc đồ Bronze, Centurion mặc
đồ Iron.

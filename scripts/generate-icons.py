from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
SCALE = 4
CANVAS = 512 * SCALE


def s(value):
    return round(value * SCALE)


def build_icon() -> Image.Image:
    image = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        (0, 0, CANVAS, CANVAS),
        radius=s(112),
        fill="#183c32",
    )
    draw.rounded_rectangle(
        (s(144), s(90), s(368), s(422)),
        radius=s(32),
        fill="#f6f1df",
    )
    line_color = "#183c32"
    for y, end_x in ((152, 328), (216, 328), (280, 276)):
        draw.rounded_rectangle(
            (s(184), s(y - 11), s(end_x), s(y + 11)),
            radius=s(11),
            fill=line_color,
        )
    draw.line(
        [(s(184), s(344)), (s(208), s(368)), (s(260), s(310))],
        fill="#e17a4d",
        width=s(22),
        joint="curve",
    )
    draw.ellipse((s(314), s(72), s(422), s(180)), fill="#d9e36e")
    draw.rounded_rectangle(
        (s(347), s(119), s(389), s(133)),
        radius=s(7),
        fill=line_color,
    )
    draw.rounded_rectangle(
        (s(361), s(105), s(375), s(147)),
        radius=s(7),
        fill=line_color,
    )
    return image


icon = build_icon()
for size in (192, 512):
    resized = icon.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(PUBLIC / f"icon-{size}.png", optimize=True)

print("Generated PWA icons.")

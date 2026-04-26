from pathlib import Path
import math

import matplotlib.pyplot as plt
from matplotlib.patches import Arc, FancyArrowPatch, Polygon, Rectangle
from matplotlib.transforms import Affine2D


plt.rcParams.update(
    {
        "font.family": "STIXGeneral",
        "mathtext.fontset": "stix",
        "figure.facecolor": "white",
        "axes.facecolor": "white",
    }
)


LINE = "#59616b"
LIGHT = "#e7f0fb"
DARK = "#c0d3eb"
BLUE = "#3298e6"
CAMERA = "#7e8791"


def rotated_rect(ax, center, width, height, angle_deg=0, **kwargs):
    rect = Rectangle((center[0] - width / 2, center[1] - height / 2), width, height, **kwargs)
    rect.set_transform(Affine2D().rotate_deg_around(center[0], center[1], angle_deg) + ax.transData)
    ax.add_patch(rect)
    return rect


def draw_camera(ax, center, width, height):
    rotated_rect(
        ax,
        center,
        width,
        height,
        facecolor=CAMERA,
        edgecolor=LINE,
        linewidth=1.4,
        zorder=6,
    )
    ax.add_patch(
        Rectangle(
            (center[0] - width / 2, center[1] + height * 0.36),
            width,
            height * 0.10,
            facecolor=BLUE,
            edgecolor="none",
            zorder=7,
        )
    )


def frustum_x(apex_x, apex_y, base_half, base_y, query_y, sign):
    scale = (apex_y - query_y) / (apex_y - base_y)
    return apex_x + sign * base_half * scale


def draw_angle_marker(ax, apex_x, apex_y, ray_left, ray_right, radius, label):
    left_angle = math.degrees(math.atan2(ray_left[1] - apex_y, ray_left[0] - apex_x))
    right_angle = math.degrees(math.atan2(ray_right[1] - apex_y, ray_right[0] - apex_x))
    theta1, theta2 = sorted([left_angle, right_angle])
    arc = Arc((apex_x, apex_y), 2 * radius, 2 * radius, theta1=theta1, theta2=theta2, lw=1.2, color="#6d6d6d", zorder=8)
    ax.add_patch(arc)
    label_angle = math.radians((theta1 + theta2) / 2)
    ax.text(
        apex_x + radius * 1.45 * math.cos(label_angle),
        apex_y + radius * 1.35 * math.sin(label_angle),
        label,
        fontsize=16,
        ha="center",
        va="center",
    )


def draw_view(ax, x0, x1, camera_style, label):
    cx = (x0 + x1) / 2
    top_y = 0.86
    bottom_y = 0.14
    dmin_y = 0.59
    dmax_y = 0.41

    ax.plot([x0 + 0.03, x1 - 0.03], [top_y, top_y], color="#b7b7b7", lw=1.3, zorder=1)
    ax.plot([x0 + 0.03, x1 - 0.03], [bottom_y, bottom_y], color="#b7b7b7", lw=1.3, zorder=1)
    ax.plot([cx, cx], [top_y - 0.01, bottom_y], color="#d5dbe5", lw=1.0, linestyle=(0, (3, 3)), zorder=1)

    if camera_style == "wide":
        cam_center = (cx - 0.06, 0.97)
        draw_camera(ax, cam_center, 0.12, 0.05)
        base_half = 0.17
        fov_label = r"$\theta^{FOV}_{y}$"
    else:
        cam_center = (cx, 0.965)
        draw_camera(ax, cam_center, 0.04, 0.09)
        base_half = 0.09
        fov_label = r"$\theta^{FOV}_{x}$"

    apex_x = cx
    apex_y = top_y - 0.02
    ray_left = (apex_x - base_half, bottom_y)
    ray_right = (apex_x + base_half, bottom_y)

    full_frustum = Polygon(
        [[apex_x, apex_y], ray_right, ray_left],
        closed=True,
        facecolor=LIGHT,
        edgecolor="none",
        alpha=0.95,
        zorder=2,
    )
    ax.add_patch(full_frustum)

    dmin_left = (frustum_x(apex_x, apex_y, base_half, bottom_y, dmin_y, -1), dmin_y)
    dmin_right = (frustum_x(apex_x, apex_y, base_half, bottom_y, dmin_y, 1), dmin_y)
    dmax_left = (frustum_x(apex_x, apex_y, base_half, bottom_y, dmax_y, -1), dmax_y)
    dmax_right = (frustum_x(apex_x, apex_y, base_half, bottom_y, dmax_y, 1), dmax_y)

    ax.plot([apex_x, dmin_left[0]], [apex_y, dmin_left[1]], color="#747474", lw=1.1, linestyle=(0, (2, 2)), zorder=4)
    ax.plot([apex_x, dmin_right[0]], [apex_y, dmin_right[1]], color="#747474", lw=1.1, linestyle=(0, (2, 2)), zorder=4)

    work_zone = Polygon(
        [dmin_left, dmin_right, dmax_right, dmax_left],
        closed=True,
        facecolor=DARK,
        edgecolor=LINE,
        linewidth=1.2,
        alpha=0.95,
        zorder=5,
    )
    ax.add_patch(work_zone)

    ax.hlines([dmin_y, dmax_y], xmin=apex_x, xmax=x1 - 0.05, colors="#9b9b9b", linestyles=":", linewidth=1.2, zorder=3)
    ax.text(x1 - 0.01, dmin_y, r"$d_{min}$", fontsize=16, va="center", ha="right")
    ax.text(x1 - 0.01, dmax_y, r"$d_{max}$", fontsize=16, va="center", ha="right")

    bracket_x = x0 + 0.07
    ax.add_patch(
        FancyArrowPatch(
            (bracket_x, dmax_y),
            (bracket_x, dmin_y),
            arrowstyle="<->",
            mutation_scale=11,
            linewidth=1.0,
            color="#818181",
            zorder=6,
        )
    )

    draw_angle_marker(ax, apex_x, apex_y, dmin_left, dmin_right, radius=0.06 if camera_style == "wide" else 0.04, label=fov_label)
    ax.text(cx, 0.04, label, fontsize=17, ha="center", va="center")


def build_figure():
    fig, ax = plt.subplots(figsize=(7.4, 4.2), dpi=220)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    draw_view(ax, 0.03, 0.56, "wide", "(a)")
    draw_view(ax, 0.56, 0.97, "tall", "(b)")
    return fig


def main():
    out_dir = Path("images")
    out_dir.mkdir(parents=True, exist_ok=True)

    fig = build_figure()
    svg_path = out_dir / "fov_work_range_variant.svg"
    png_path = out_dir / "fov_work_range_variant.png"

    fig.savefig(svg_path, facecolor="white", bbox_inches="tight")
    fig.savefig(png_path, facecolor="white", dpi=300, bbox_inches="tight")
    plt.close(fig)

    print(svg_path.resolve())
    print(png_path.resolve())


if __name__ == "__main__":
    main()

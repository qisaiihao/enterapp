from pathlib import Path
import math

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Arc, Circle, Ellipse, FancyArrowPatch, Polygon, Rectangle
from matplotlib.transforms import Affine2D


plt.rcParams.update(
    {
        "font.family": "STIXGeneral",
        "mathtext.fontset": "stix",
        "figure.facecolor": "white",
        "axes.facecolor": "white",
    }
)


LINE = "#555555"
LIGHT = "#e9edf3"
MID = "#cfd6e0"
CAMERA = "#808890"
BLUE = "#2d98e5"
RED = "#d96c6c"


def setup_panel(ax):
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.set_aspect("equal")
    ax.axis("off")


def rotate_point(dx, dy, angle_deg):
    angle = math.radians(angle_deg)
    return (
        dx * math.cos(angle) - dy * math.sin(angle),
        dx * math.sin(angle) + dy * math.cos(angle),
    )


def add_rotated_rectangle(ax, center, width, height, angle_deg=0, **kwargs):
    rect = Rectangle((center[0] - width / 2, center[1] - height / 2), width, height, **kwargs)
    rect.set_transform(Affine2D().rotate_deg_around(center[0], center[1], angle_deg) + ax.transData)
    ax.add_patch(rect)
    return rect


def add_camera(ax, center, angle_deg=0, scale=1.0):
    body_w = 0.16 * scale
    body_h = 0.06 * scale

    add_rotated_rectangle(
        ax,
        center,
        body_w,
        body_h,
        angle_deg,
        facecolor=CAMERA,
        edgecolor=LINE,
        linewidth=1.2,
        zorder=6,
    )

    stripe_offset = rotate_point(0, body_h * 0.42, angle_deg)
    add_rotated_rectangle(
        ax,
        (center[0] + stripe_offset[0], center[1] + stripe_offset[1]),
        body_w,
        body_h * 0.10,
        angle_deg,
        facecolor=BLUE,
        edgecolor="none",
        zorder=7,
    )

    for ratio in (-0.25, 0.25):
        screw_offset = rotate_point(body_w * ratio, body_h * 0.42, angle_deg)
        ax.add_patch(
            Circle(
                (center[0] + screw_offset[0], center[1] + screw_offset[1]),
                radius=0.008 * scale,
                facecolor="#6f6f6f",
                edgecolor="none",
                zorder=8,
            )
        )


def add_dome(ax, center, width, height):
    cx, cy = center
    ax.add_patch(Arc((cx, cy), width, height, theta1=0, theta2=180, lw=2.0, color="black", zorder=4))
    ax.add_patch(Arc((cx, cy), width, width * 0.18, theta1=180, theta2=360, lw=1.8, color="black", zorder=4))
    ax.add_patch(
        Arc(
            (cx, cy - height * 0.02),
            width * 0.60,
            width * 0.08,
            theta1=18,
            theta2=162,
            lw=1.4,
            linestyle=(0, (5, 4)),
            color="black",
            zorder=3,
        )
    )


def add_curved_dimension(ax, start, end, label, rad=0.25, text_offset=(0, 0)):
    arrow = FancyArrowPatch(
        start,
        end,
        arrowstyle="<->",
        mutation_scale=10,
        linewidth=1.0,
        color="#777777",
        connectionstyle=f"arc3,rad={rad}",
        zorder=8,
    )
    ax.add_patch(arrow)
    mid = ((start[0] + end[0]) * 0.5 + text_offset[0], (start[1] + end[1]) * 0.5 + text_offset[1])
    ax.text(mid[0], mid[1], label, ha="center", va="center", fontsize=16)


def frustum_x(apex_x, apex_y, base_half, base_y, query_y, sign):
    ratio = (apex_y - query_y) / (apex_y - base_y)
    return apex_x + sign * base_half * ratio


def add_panel_label(ax, label):
    ax.text(0.5, -0.06, label, transform=ax.transAxes, ha="center", va="top", fontsize=18)


def draw_panel_a(ax):
    setup_panel(ax)

    top_y = 0.88
    bottom_y = 0.14
    dmin_y = 0.60
    dmax_y = 0.42

    ax.plot([0.04, 0.96], [top_y, top_y], color="#b0b0b0", lw=1.3)
    ax.plot([0.04, 0.96], [bottom_y, bottom_y], color="#b0b0b0", lw=1.3)
    ax.hlines([dmin_y, dmax_y], 0.30, 0.82, colors="#989898", linestyles=":", linewidth=1.2)
    ax.text(0.84, dmin_y, r"$d_{min}$", va="center", fontsize=16)
    ax.text(0.84, dmax_y, r"$d_{max}$", va="center", fontsize=16)

    configs = [
        {
            "apex_x": 0.24,
            "camera_center": (0.18, 0.98),
            "camera_scale": 1.0,
            "camera_size": "wide",
            "base_half": 0.18,
            "label": r"$\theta^{FOV}_{y}$",
        },
        {
            "apex_x": 0.69,
            "camera_center": (0.69, 0.98),
            "camera_scale": 0.68,
            "camera_size": "tall",
            "base_half": 0.10,
            "label": r"$\theta^{FOV}_{x}$",
        },
    ]

    apex_y = top_y - 0.015
    for item in configs:
        apex_x = item["apex_x"]
        base_half = item["base_half"]

        full_cone = np.array([[apex_x, apex_y], [apex_x + base_half, bottom_y], [apex_x - base_half, bottom_y]])
        ax.add_patch(Polygon(full_cone, closed=True, facecolor=LIGHT, edgecolor="none", zorder=1))

        dmin_left = (frustum_x(apex_x, apex_y, base_half, bottom_y, dmin_y, -1), dmin_y)
        dmin_right = (frustum_x(apex_x, apex_y, base_half, bottom_y, dmin_y, 1), dmin_y)
        dmax_left = (frustum_x(apex_x, apex_y, base_half, bottom_y, dmax_y, -1), dmax_y)
        dmax_right = (frustum_x(apex_x, apex_y, base_half, bottom_y, dmax_y, 1), dmax_y)

        ax.plot([apex_x, dmin_left[0]], [apex_y, dmin_left[1]], linestyle=(0, (2, 2)), color="#707070", lw=1.1)
        ax.plot([apex_x, dmin_right[0]], [apex_y, dmin_right[1]], linestyle=(0, (2, 2)), color="#707070", lw=1.1)

        work_region = np.array([dmin_left, dmin_right, dmax_right, dmax_left])
        ax.add_patch(Polygon(work_region, closed=True, facecolor=MID, edgecolor=LINE, linewidth=1.1, alpha=0.95, zorder=2))

        if item["camera_size"] == "wide":
            add_camera(ax, item["camera_center"], scale=item["camera_scale"])
        else:
            add_rotated_rectangle(
                ax,
                item["camera_center"],
                0.038,
                0.085,
                facecolor=CAMERA,
                edgecolor=LINE,
                linewidth=1.2,
                zorder=6,
            )
            stripe_center = (item["camera_center"][0], item["camera_center"][1] + 0.035)
            ax.add_patch(Rectangle((stripe_center[0] - 0.019, stripe_center[1] - 0.004), 0.038, 0.008, facecolor=BLUE, edgecolor="none", zorder=7))
            ax.add_patch(Circle((item["camera_center"][0], item["camera_center"][1] + 0.040), 0.005, facecolor="#6f6f6f", edgecolor="none", zorder=8))

        start = (apex_x - base_half * 0.78, bottom_y + 0.005)
        end = (apex_x + base_half * 0.78, bottom_y + 0.005)
        add_curved_dimension(ax, start, end, item["label"], text_offset=(0, -0.09))

    add_panel_label(ax, "(a)")


def draw_panel_b(ax):
    setup_panel(ax)

    add_dome(ax, center=(0.56, 0.30), width=0.72, height=0.42)
    point = np.array([0.56, 0.51])
    viewpoint = np.array([0.30, 0.77])
    normal_tip = np.array([0.56, 0.83])

    ax.add_patch(Circle(point, radius=0.016, facecolor="#7a7a7a", edgecolor="none", zorder=7))
    ax.add_patch(FancyArrowPatch(point, normal_tip, arrowstyle="-|>", mutation_scale=18, linewidth=2.0, color="#7a7a7a", zorder=6))
    ax.add_patch(FancyArrowPatch(point, viewpoint, arrowstyle="-|>", mutation_scale=18, linewidth=2.0, color="#7a7a7a", zorder=6))
    add_camera(ax, center=(0.25, 0.82), angle_deg=24, scale=0.9)

    angle_to_view = math.degrees(math.atan2(viewpoint[1] - point[1], viewpoint[0] - point[0]))
    ax.add_patch(Arc(point, 0.22, 0.22, theta1=90, theta2=angle_to_view, color="#6f6f6f", lw=1.2, zorder=5))

    ax.text(0.62, 0.84, r"$\vec{n}$", fontsize=18)
    ax.text(0.12, 0.70, r"$p_{v_i}$", fontsize=16)
    ax.text(0.46, 0.64, r"$\theta$", fontsize=18)
    ax.text(point[0], point[1] - 0.10, "P", ha="center", va="center", fontsize=18)

    add_panel_label(ax, "(b)")


def draw_panel_c(ax):
    setup_panel(ax)

    add_dome(ax, center=(0.42, 0.25), width=0.62, height=0.34)
    add_camera(ax, center=(0.15, 0.82), angle_deg=28, scale=0.95)

    point = np.array([0.43, 0.34])
    ray_origin = np.array([0.16, 0.77])

    visible_patch = np.array(
        [
            [0.27, 0.14],
            [0.31, 0.25],
            [0.38, 0.42],
            [0.58, 0.36],
            [0.40, 0.20],
        ]
    )
    occluder = np.array(
        [
            [0.31, 0.28],
            [0.35, 0.39],
            [0.43, 0.35],
            [0.40, 0.24],
        ]
    )

    ax.add_patch(Polygon(visible_patch, closed=True, facecolor=RED, edgecolor="#914747", linewidth=1.0, alpha=0.55, zorder=4))
    ax.add_patch(Polygon(occluder, closed=True, facecolor="#c95757", edgecolor="none", alpha=0.55, hatch="////", zorder=5))

    for target in (visible_patch[0], visible_patch[2], point):
        ax.plot([ray_origin[0], target[0]], [ray_origin[1], target[1]], linestyle=(0, (2, 2)), color="#707070", lw=1.1, zorder=2)

    ax.add_patch(Circle(point, radius=0.016, facecolor="#7a7a7a", edgecolor="none", zorder=7))
    ax.text(point[0] + 0.05, point[1] - 0.05, "P", ha="center", va="center", fontsize=18)

    add_panel_label(ax, "(c)")


def draw_panel_d(ax):
    setup_panel(ax)

    center = np.array([0.50, 0.48])
    radius = 0.35

    outer = Circle(center, radius, facecolor="#fbfbfb", edgecolor="#d8d8d8", linewidth=1.2, zorder=1)
    ax.add_patch(outer)

    for scale, alpha in [(0.92, 0.12), (0.75, 0.08), (0.58, 0.05)]:
        ax.add_patch(Circle(center, radius * scale, facecolor="#f2f2f2", edgecolor="none", alpha=alpha, zorder=1))

    ax.plot([center[0] - radius, center[0] + radius], [center[1], center[1]], color="#d2d2d2", lw=1.0, zorder=2)
    ax.plot([center[0], center[0]], [center[1] - radius, center[1] + radius], color="#d2d2d2", lw=1.0, zorder=2)

    for width, alpha in [(0.16, 0.14), (0.08, 0.22)]:
        band = Rectangle((center[0] - width / 2, center[1] - radius), width, radius * 2, facecolor="#f08080", edgecolor="none", alpha=alpha, zorder=2)
        band.set_clip_path(outer)
        ax.add_patch(band)

    arm = np.array([[0.22, 0.60], [0.34, 0.66], [0.44, 0.60], [0.54, 0.50], [0.54, 0.38]])
    ax.plot(arm[:, 0], arm[:, 1], color="#b3b3b3", lw=5.0, solid_capstyle="round", zorder=5)
    ax.plot(arm[:, 0], arm[:, 1], color="#707070", lw=1.2, solid_capstyle="round", zorder=6)

    for joint in arm[:-1]:
        ax.add_patch(Circle(joint, radius=0.022, facecolor="white", edgecolor="#8f8f8f", linewidth=1.1, zorder=7))

    end = arm[-1]
    ax.add_patch(Rectangle((end[0] - 0.02, end[1] - 0.02), 0.04, 0.03, facecolor="white", edgecolor="#8f8f8f", linewidth=1.0, zorder=7))
    ax.plot([end[0] - 0.013, end[0] - 0.013], [end[1] - 0.03, end[1] + 0.005], color="#8f8f8f", lw=1.0, zorder=7)
    ax.plot([end[0] + 0.013, end[0] + 0.013], [end[1] - 0.03, end[1] + 0.005], color="#8f8f8f", lw=1.0, zorder=7)

    add_panel_label(ax, "(d)")


def build_figure():
    fig = plt.figure(figsize=(9, 6), dpi=200)
    grid = fig.add_gridspec(2, 2, width_ratios=[1.35, 1.0], height_ratios=[1.0, 0.92], wspace=0.10, hspace=0.18)

    draw_panel_a(fig.add_subplot(grid[0, 0]))
    draw_panel_b(fig.add_subplot(grid[0, 1]))
    draw_panel_c(fig.add_subplot(grid[1, 0]))
    draw_panel_d(fig.add_subplot(grid[1, 1]))

    fig.subplots_adjust(left=0.04, right=0.98, top=0.98, bottom=0.08)
    return fig


def main():
    output_dir = Path("images")
    output_dir.mkdir(parents=True, exist_ok=True)

    figure = build_figure()
    svg_path = output_dir / "figure3_constraints_simplified.svg"
    png_path = output_dir / "figure3_constraints_simplified.png"

    figure.savefig(svg_path, facecolor="white")
    figure.savefig(png_path, dpi=300, facecolor="white")
    plt.close(figure)

    print(svg_path.resolve())
    print(png_path.resolve())


if __name__ == "__main__":
    main()

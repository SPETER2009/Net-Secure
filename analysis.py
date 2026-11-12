"""Core math for the Network Traffic Analyzer.

Pure numpy, no web code, so it can be tested and reused on its own.

The three analyses (same ideas as the original script):
  1. Node importance  - the dominant eigenvector of the traffic matrix
                        (eigenvector centrality), scaled to sum to 1.
  2. Data reduction   - project the matrix onto its top-2 eigenvectors so
                        every device is described by just 2 numbers.
  3. Traffic forecast - repeatedly multiply by the (normalised) traffic
                        matrix. This is the "power method": the traffic
                        shares settle onto the dominant eigenvector.
"""

import numpy as np

MAX_DEVICES = 20
DEFAULT_STEPS = 10


def validate(devices, matrix):
    """Check the input and return (clean_names, matrix_as_float_array).

    Raises ValueError with a human-readable message on bad input.
    """
    n = len(devices)
    if n < 2:
        raise ValueError("Add at least 2 devices.")
    if n > MAX_DEVICES:
        raise ValueError(f"At most {MAX_DEVICES} devices are supported.")

    names = [str(d).strip() for d in devices]
    if any(not name for name in names):
        raise ValueError("Every device needs a name.")
    if len({name.lower() for name in names}) != n:
        raise ValueError("Device names must be unique.")

    try:
        A = np.array(matrix, dtype=float)
    except ValueError:
        raise ValueError("The traffic matrix must be a square grid of numbers.")

    if A.shape != (n, n):
        raise ValueError(
            f"The traffic matrix must be {n} x {n} to match {n} devices."
        )
    if not np.all(np.isfinite(A)):
        raise ValueError("Traffic values must be finite numbers.")
    if np.any(A < 0):
        raise ValueError("Traffic values cannot be negative.")
    if A.max() <= 0:
        raise ValueError("All traffic values are zero - enter some traffic first.")

    return names, A


def analyze(devices, matrix, steps=DEFAULT_STEPS):
    """Run all three analyses and return a JSON-friendly dict."""
    names, A = validate(devices, matrix)
    n = len(names)

    # Traffic between two devices is treated as undirected, so we work with
    # the symmetric version of A. For an already-symmetric matrix S == A.
    S = (A + A.T) / 2

    # eigh is the right tool for symmetric matrices: real eigenvalues,
    # orthonormal eigenvectors, no complex-number surprises.
    values, vectors = np.linalg.eigh(S)
    order = np.argsort(np.abs(values))[::-1]          # biggest first
    values, vectors = values[order], vectors[:, order]

    # 1. Node importance (eigenvector centrality)
    dominant = np.abs(vectors[:, 0])
    importance = dominant / dominant.sum()

    # 2. Data reduction: n devices -> 2 numbers each
    reduced = A @ vectors[:, :2]
    # How much of the matrix's total strength the 2 components keep.
    kept = float((values[:2] ** 2).sum() / (values ** 2).sum())

    # 3. Traffic forecast (power method). Normalising every step keeps the
    #    numbers readable: each value is a device's share of total traffic.
    A_norm = A / A.max()
    x = np.full(n, 1.0 / n)
    history = [x]
    for _ in range(steps):
        x = A_norm @ x
        total = x.sum()
        if total > 0:
            x = x / total
        history.append(x)

    traffic_total = S.sum(axis=1) - np.diag(S)        # excludes self-traffic
    top = int(np.argmax(importance))

    return {
        "devices": names,
        "importance": np.round(importance, 6).tolist(),
        "top_device": names[top],
        "reduced": np.round(reduced, 4).tolist(),
        "kept_by_2d": round(kept, 6),
        "eigenvalues": np.round(values, 4).tolist(),
        "history": np.round(np.array(history), 6).tolist(),
        "traffic_total": np.round(traffic_total, 4).tolist(),
    }

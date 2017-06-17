# Modular Arithmetic

## The modulo operator

If we increase an integer $x$ by a multiple of $y$, then we end up in the same spot modulo $y$:  

$$x\bmod y = (x + ky) \bmod y$$

for any positive $k$, i.e., adding a multiple of $y$ to $x$ does not affect the outcome of applying the modulo operation. For example:

$$-5 \bmod 3 = (-5 + 2 \cdot 3) \bmod 3 = (-5 + 6) \bmod 3 = 1\bmod 3 = 1$$

This leads to the visualization of the modulo operation using a "clock" (see [here](https://www.khanacademy.org/computing/computer-science/cryptography/modarithmetic/a/what-is-modular-arithmetic), e.g.).

### Negation

The following equality holds for any natural numbers $x$ and $y$:

$$-x \bmod y = (y - (x \bmod y)) \bmod y$$

The outer application of the modulo operator takes care of cases where the  $x\bmod y = 0$, for example:

$$-3\bmod 3 = (3 - (3\bmod 3)) \bmod 3 = (3 - 0) \bmod 3 = 3 \bmod 3 = 0.$$

If we were to omit the outer modulo operator, we would obtain, wrongly, $3$ as a result.

If, on the other hand, $x\bmod y > 0$, then the following also holds:

$$-x \bmod y = y - (x \bmod y)$$

### Addition

The modulo operator distributes over addition:

$$(a + b) \bmod c = (a \bmod c + b \bmod c ) \bmod c$$

As with negation above, we need to re-apply the modulo operation to "keep things in range".

## The congruence relation

Given an integer $z$, the modulo operation partitions the integers into a set of equivalence classes. For an integer $x$, its equivalence class ${[}x{]}_{z}$ is given by:

$${[}x{]}_z \quad:=\quad \lbrace y \mid x\bmod z = y\bmod z \rbrace.$$

Given any integer $z$, there are $z$ equivalence classes modulo $z$, i.e,

$${[}0{]}_z , \ldots, {[}z-1{]}_z.$$

The partition induces an equivalence relation $\equiv_{\bmod z}$, i.e.,

$$x\equiv_{\bmod z} y \quad\Leftrightarrow\quad {[}x{]}_{z} = {[}y{]}_{z}.$$

If $x\equiv_{\bmod z} y,$ then we say that $x$ is congruent to $y$ modulo $z$.

The relation $\equiv_{\bmod z}$ is (indeed) a *congruence*, that is, an equivalence relation that is compatible with addition and multiplication on the integers, i.e., if

$$a_1 \equiv_{\bmod n} a_2\text{ and }b_1\equiv_{\bmod n}b_2$$

then also

$$a_1 + b_1 \equiv_{\bmod n} a_2 + b_2\text { and }a_1 \cdot b_1 \equiv_{\bmod n} a_2 \cdot b_2$$

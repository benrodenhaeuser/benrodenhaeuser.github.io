# Tic Tac Toe with Negamax

----

Comment, December 2017:

This is actually an example of a tree-recursive process.

It should be possible to do this in various ways:
- brute force
- with memoization
- with alpha/beta pruning
- with dynamic programming (bottom-up)

In fact, all but the last ones I have done already.


----


The first version of the Tic Tac Toe negamax algorithm that I implemented was painfully slow. It took more than 30 seconds to return a move for the initial position of a standard 3x3 game. So I had a strong incentive to try and understand the algorithm better. Beginning programmers are typically advised not to spend time worrying about performance, but here, we are not talking about micro-optimization – we are talking about an algorithm implementation that makes a game unplayable.

In this post, I will discuss the baseline negamax algorithm for solving Tic Tac Toe, and a few improvements to this algorithm – both more generic ones (that could be applied, more or less directly, to any strictly competitive games) and more specific ones (that exploit certain properties of *this* game, Tic Tac Toe).

<!-- ## Tic Tac Toe

We will represent a 3x3 Tic Tac Toe position as a nine-element array that we can access by index, with indices ranging from 0 to 8. Using the common player markers, and a blank space for squares that have not been chosen by either of the players yet. So the following board position ...

... will be represented by this array:

```ruby
['X', 'O', ' ', 'X', ' ', ' ', ' ', ' ', ' ']
```

Let's now agree on a bag of Ruby methods that implement the rules of Tic Tac Toe for us. -->

## Brute force Negamax

Here is an implementation of the Negamax algorithm for Tic Tac Toe in Ruby:

```ruby
def nega_max(player, state)
  if terminal?(state)
    payoff(player, state)
  else
    available_moves(state).map do |move|
      make(move, player, state)
      value_for_move = -nega_max(opponent(player), state)
      unmake(move, state)
      value_for_move
    end.max
  end
end
```

The method returns the value of a game state `state` for the player `player`, assumed to be the player who moves next. This value is the highest payoff that `player` can be guaranteed to achieve with optimal play, and it is denoted  with the variable `best_value`.

For terminal states, the value of `state` for `player` is given by the Tic Tac Toe payoff function — that's the first branch of the conditional:

```ruby
best_value = payoff(player, state)
```

For non-terminal states, `player` has to evaluate all available choices. Suppose she is at the moment looking at one particular move `move`. She makes the move (that's the line `make(move, player, state)`, which updates `state` as a side-effect), and evaluates the resulting position. She uses our `nega_max` method to do this. Assume that the method tells her that the best her opponent can do in the successor state (referenced by `state` at this point) is $n$. So what can `player` herself achieve by choosing `move`? It's $-n$. Here is why:

- If `opponent(player)` can guarantee a win, then opponent will get $1$, so `player` gets $-1$ if she chooses `move`.
- If `opponent(player)` can only guarantee a tie, opponent will get $0$, so `player` gets $-0$, which is $0$.
- If `opponent(player)` is bound to lose, opponent will get $-1$, so `player` gets $-(-1)$, which is $1$.

So the best `player` can guarantee to achieve when choosing `move` is indeed $-n$. This explains the crucial line of the method containing the recursive call:

```ruby
value_for_move = -nega_max(opponent(player), state)
```

Notice that this only works because Tic Tac Toe is *zero-sum*, i.e., one player's loss is another player's gain: the payoffs of both players always add up to 0.

Return to `player`, who is deliberating which move to take. She proceeds in the manner described, evaluating *all* her moves. In this way, `player` obtains a list of values, one for each move (that list is the return value of the `map` invocation). The maximal value from this list is the best she can guarantee, so this is what we return.

## The best move

## Algorithms

- brute force negamax
- negamax with transposition table
- negamax with symmetry table
  - consider: instead of solving all of the eight subtrees of the initial game node, we have to solve just three.
- negamax with symmetry lookup
- alpha-beta pruning
- negamax with shortcuts

these fall onto a spectrum from "more generic" to "more game-specific"
- negamax and negamax with alpha-beta pruning are generic algorithms that work pretty much for every game.
- transposition tables are useful whenever there are several ways to reach the same position.
- symmetry is useful if there are ... symmetries!
- the shortcut method makes use of the fact that tic tac toe is solved. so why not use the fact that the best we can guarantee is a tie?


## Results

|                     | time     |   calls | table size  |
|:--------------------|---------:|--------:|------------:|
| brute force         | 5.781872 | 549,946 |           - |
| transposition table | 0.105050 |  16,168 |       5,477 |
| symmetry table      | 0.048830 |   2,271 |       5,477 |
| symmetry lookup     | 0.058844 |   2,271 |         764 |
| alpha-beta          | 0.193677 |  18,297 |           - |


- 549,946 is the size of the 3x3 ttt game tree (i.e., the number of nodes)
- 5477 is the number of distinct board positions minus the initial state
- 764 is the number of board positions up to symmetry minus the initial state

- In the transposition table case, around 6,000 calls are calls that result (as a side-effect) in values being stored to the lookup table, whereas around 10,000 calls return a looked-up value.

- In the symmetry table case, the table is built "much faster", because whenever we save to the table, we save eight values instead of merely one.

### time

- with a symmetry table, we can realize a hundred fold speed increase.

- memoizing values is a dramatic improvement over brute force negamax
- exploiting symmetries allows us reduce computation time by half
- saving symmetric values as we compute them seems slightly faster than computing symmetries during lookup
- the memoization approaches are quite a bit faster than alpha-beta-search on a 3x3 board
- (it looks like alpa-beta scales a lot better, viz the results for a 4x4 board)

### calls

- brute force: the number of method calls is a lot higher than the number of distinct positions, because many positions are computed several times.
- transposition table: with this algorithm, the number of calls is still higher than the number of positions, because it may happen that our negamax method is called for some state, even if that state has been evaluated already and stored ... but we still need to retrieve it!
- symmetry table: now the number of calls is lower than the size of the table. this looks certainly odd at first sight. but the thing is that with every function call, we write up to eight new values to the table.

### method calls in relation to time
- the number of method calls does not correlate neatly with computation time spent.
- compare brute force and transposition table: 549946/16168 is about 34, so the evaluation function is called 34 times less when we use the transposition table vs brute force. the speed gain, on the other hand, is around 57-fold. Why is that?
- When going from a transposition to a symmetry table, there is a 7-fold decrease in function calls, but the computation time is only halved. Filling in the table entries comes with an extra cost that partially offsets avoiding negamax calls. That seems to be the plausible explanation.

- **What does the number of method calls actually correspond to?** In brute force negamax, it is simply the number of nodes in the complete game tree (see https://books.google.com/books?id=1xHPDAAAQBAJ&pg=PA151&lpg=PA151&dq=size+of+tic+tac+toe+game+tree&source=bl&ots=J3Tp09kbbL&sig=DJoyUjGx2XGMm-gvMg-QW5bQ8sI&hl=de&sa=X&ved=0ahUKEwivzpGyjpHUAhVG0WMKHVRqD704ChDoAQhXMAc#v=onepage&q=size%20of%20tic%20tac%20toe%20game%20tree&f=false)

### table size

- transposition table: there are 5478 distinct positions in 3x3 tic tac toe (see http://www.mathrec.org/old/2002jan/solutions.html). Since we do not store a value for the initial state in the table, our table has 5477 entries.
- symmetry lookup: since we only store a "representative" of each equivalence class, this is a smaller table. there are 765 distinct ttt positions modulo symmetries (see http://www.mathrec.org/old/2002jan/solutions.html), and since we don't store the initial state, our table has 764 entries.

### Why is the number of method calls smaller than the number of distinct ttt positions when we use a symmetry table?

This might come as a surprise, because shouldn't we have to visit every distinct node at least once? well, no, actually! The reason we don't have to do this is that there are certain positions we never even have to evaluate, because they are descendants of nodes that are symmetric to nodes we have evaluated (if that makes sense).

### shortcut

- suppose we already know that the best we can guarantee is a tie. then we could stop looking for a win (we know we cannot find a guaranteed win path), but instead look for a tie path. this is the idea behind the two "shortcut" algorithms I looked at: one adds the shortcut to the brute force algorithm, the second adds the shortcut to the transposition table. The second one (transposition with shortcut) is the fastest algorithms I considered.

- there is a pitfall here, however. if we are playing against a less than perfect opponent, than we might miss a chance to score a win if we take the shortcut!

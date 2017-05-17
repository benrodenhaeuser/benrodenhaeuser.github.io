
- Tic Tac Toe for computer against computer?
- Plug in various algorithms.

## Determining the value of a Tic Tac Toe board

We can think of the value of a game position as the best a player can achieve in that position assuming optimal play.

### Brute force negamax for Tic Tac Toe:

```ruby
def value(board, player)
  if done?(board)
    result_for(player, board)
  else
    values = available_moves(board).map do |move|
      update(board, move, player)
      value = -value(board, opponent_of(player))
      undo(move, board)
      value
    end
    values.max
  end
end
```

Benchmark: 7.04 seconds

### Negamax with memoization

Improvement: we don't simply compute values and forget them, we store them so that we do not have to recompute them down the road.

```ruby
def value(board, player, memo = {})
  return memo[board.to_s] if memo[board.to_s]

  if done?(board)
    memo[board.to_s] = result_for(player, board)
  else
    values = available_moves(board).map do |move|
      update(board, move, player)
      value = -value(board, opponent_of(player), memo)
      undo(move, board)
      value
    end
    memo[board.to_s] = values.max
  end
end
```

Benchmark: 0.39 seconds

### Negamax with Alpha-Beta Pruning

How does this work?


## Determining the best possible move

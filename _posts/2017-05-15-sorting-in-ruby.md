# Sorting in Ruby

Ruby has two built-in methods for sorting collections: `sort` and `sort_by`. Both are contained in the `Enumerable` module, which any Ruby class can include as long as it implements a an `each` method for iterating over instances of the class. The elements of a collection also need to implement a three-way comparison method `<=>` (the "spaceship operator") if we want to invoke `sort` or `sort_by` on that collection.

My question for this post is this: why would there be two sort methods rather than just one?

## Exploring `sort_by`

Let's first try to get a clearer picture how `sort_by` works. Start with an example. Suppose we would like to sort the following array *by the numerical values* of its string elements:

```ruby
arr = ['0', '10', '3']
```

This can be achieved using `sort_by` as follows:

```ruby
arr.sort_by { |string| string.to_i }
end
# => ['0', '3', '10']
```

Or using shorthand:

```ruby
arr.sort_by(&:to_i)
# => ['0', '3', '10']
```

Now the question is: how does `sort_by` do its magic? My initial hunch when exploring this topic was that `sort_by` seems fairly closely related to the functionality provided by the `map` method, also contained in `Enumerable`. There is a hint in the Ruby Docs that points in the same direction: ["The current implementation of `sort_by` generates an array of tuples containing the original collection element and the mapped value"](http://ruby-doc.org/core-2.4.1/Enumerable.html#method-i-sort_by).

Based on this, it looks like what `sort_by` must be doing is something like this:

1. Transform the given array to an array of pairs (making use of the block that was passed).
2. Sort the array of pairs by accessing the second component of each pair (relying on the `<=>` method defined for the second component).
3. Project each pair to its first component.

The result of step 3 is your sorted array.

After some Googling, I found out that this is actually a pretty well-known technique, often called [Schwartzian transform](https://en.wikipedia.org/wiki/Schwartzian_transform) among Perl programmers. So it does look like `sort_by` works just in this way.

Let's make things more concrete by implementing a toy version of `sort_by` ourselves. This will come in handy in the second part of the post, when we want to compare `sort` and `sort_by`. Plus it's a nice exercise – when learning a language, it can be useful to re-implement methods of interest to deepen understanding, I have been told at [Launch School](http://launchschool.com).

First, we observe that we can actually express the above three steps in Ruby code fairly easily – this is where the `map` method comes into play. For our running example, observe that the sorted array can be obtained as follows:

```ruby
arr.map { |elem| [elem, elem.to_i] } # step (1)
  .sort { |pair1, pair2| pair1.last <=> pair2.last } # step (2)
  .map { |pair| pair.first } # step (3)
# => ['0', '3', '10']
```

Notice that we have replaced the invocation of `sort_by` with calls to `map`, `sort` and `<=>`. This is obviously a lot more cumbersome than using `sort_by` itself – but it makes it fairly clear how our re-implementation of `sort_by` should look like. Here it is:

```ruby
module Enumerable
  def my_sort_by
    self.map { |elem| [elem, yield(elem)] }
      .sort { |pair1, pair2| pair1.last <=> pair2.last }
      .map { |pair| pair.first }
  end
end
```

Looking at the [Rubinius code for `sort_by`](https://github.com/rubinius/rubinius/blob/f9c2dffa4c894eea88abe1e476688df549a2bc4b/core/enumerable.rb#L351) – a hint I got from one of the instructors at Launch School when sharing a draft of this post – we see just this pattern: a `map` invocation followed by a `sort` invocation followed by a `map` invocation. Rubinius even has a special class for representing tuples of the required kind. It is called `SortedElement` and comes with a `<=>` method that compares instances based on the value of the second element of the tuple.

For our running example, `my_sort_by` yields the desired return value:

```ruby
arr.my_sort_by { |elem| elem.to_i } # => ['0', '3', '10']
```

Or, using shorthand:

```ruby
arr.my_sort_by(&:to_i) # => ['0', '3', '10']
```

Let's now return to our original question: why would Ruby have two sort methods rather than just one?

## The cost of transformation

It turns out that there is a reason for favouring `sort_by` over `sort`, at least in certain scenarios: efficiency.

Both `sort` and `sort_by` are based on comparisons of elements of the collection we want to sort. Comparison-based sorting [has a lower bound of $O(n \log n)$](https://www.cs.cmu.edu/~avrim/451f11/lectures/lect0913.pdf) in the worst case, which is to say that it is not possible to come up with an algorithm for sorting that performs better (in a worst-case scenario). This is because, in the worst case, $n \log n$ comparisons of elements have to be made in order to determine the correct sort order. Ruby [uses quicksort for sorting](https://www.igvita.com/2009/03/26/ruby-algorithms-sorting-trie-heaps/), an algorithm that has a worst case complexity of $O(n^2)$, but is $O(n \log n)$ on average (as it turns out, $O(n \log n)$ is the lower bound for the average case as well, so quicksort is optimal for average cases).

Since quicksort is the sort algorithm powering both `sort` and `sort_by`, wouldn't it be reasonable to think that both methods should have the same performance? The answer is no, and the reason is that the overall picture is complicated by the fact that we often do not wish to sort a given collection *as is* (i.e., relying on the `<=>` operator provided for its elements), but rather relying on some special "property" of its elements, i.e., a sort criterion, or *sort key*. For example, we may want to sort user profiles by users' last names, or available moves in a game by their expected utility – or strings by integer value, as in our running example above. The last name, the expected utility, the integer value – those would be our sort keys.

Now unless the sort keys are simply given to us along with the values we want to sort, we will have to compute those keys ourselves. This takes time above and beyond the actual sorting. And this is where `sort` and `sort_by` differ.

Both of these methods allow us to do key-based sorting by passing a block with the method invocation. Suppose we have a method `key` that transforms the elements of a collection `list` to sort keys of the required kind (in our running example, the relevant transformation is simply to convert strings to integers, because numeric values are what we want to sort by). Then we can sort our list with the `sort` method as follows:  

```ruby
list.sort { |elem1, elem2| key(elem1) <=> key(elem2) }
```

Using `sort_by`, as we have seen above, we would do it like this:

```ruby
list.sort_by { |elem| key(elem) }
```

It looks like using `sort_by` saves us a little bit of typing. But we are also saving a lot of computation time, potentially. Remember from above: what is happening "under the hood" when we invoke `sort_by` in the way just described is something like this:

```ruby
list.map { |elem| [elem, key(elem)] }
  .sort { |pair1, pair2| pair1.last <=> pair2.last }
  .map { |pair| pair.first }
end
```

Clearly, this procedure involves $n$ calls to the `key` method, assuming that the length of `list` is $n$: we call `key` once for each element `elem` of `list`, storing the pair `[elem, key(elem)]` in our intermediate array. However, when using `sort`, the number of calls to the `key` method may be quite a bit larger. As observed earlier, sorting our list involves making $O(n\log n)$ comparisons on average, and even $O(n^2)$ comparisons in the worst case (since quicksort is Ruby's search algorithm of choice). If we use `sort`, each such comparison will require two *on the fly* calls to the `key` method. In cases where `key` itself is a time-consuming transformation, having to perform it $O(n\log n)$ times (or $O(n^2)$ times, for that matter) rather than merely $O(n)$ times will make a big difference indeed.

So computing the keys ahead of time, and saving them for later use – as `sort_by` does, a technique known as [memoization](https://en.wikipedia.org/wiki/Memoization) – may come with a significant performance gain over computing the keys on an as-needed basis, as `sort` does. If, on the other hand, the transformation is trivial, `sort` may still be faster than `sort_by` – the time saved by avoiding calls to the `key` method may then be more than offset by the effort of calling `map` twice. The Ruby Docs for `sort_by` [give an example of this](http://ruby-doc.org/core-2.4.1/Enumerable.html#method-i-sort_by). So, as usual, there are trade-offs involved.

*Thanks to Pete Hanson from Launch School for valuable information on the topic of this post.*

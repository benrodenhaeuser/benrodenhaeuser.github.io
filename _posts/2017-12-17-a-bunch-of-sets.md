---
title: "A Bunch of Sets"
description: "A generic implementation of classical sets, multisets and fuzzy sets in Ruby."
date: 2017-12-17
---

Ruby comes with a [`Set` class](https://github.com/ruby/ruby/blob/trunk/lib/set.rb) as part of its standard library, and there is also a [`Multiset` class](https://github.com/maraigue/multiset/blob/master/lib/multiset.rb) available as a gem. Both classes uses hashes internally. However, the two libraries are completely separate, so, of course, they do not share any code. This is somewhat regrettable, since—as we will see during the course of our discussion—sets and multisets have quite a bit in common. For this reason, I thought that it would be a nice exercise to write a more generic set class from scratch that would allow us to derive the functionality provided by the above-mentioned classes by inheritance. For good measure, I decided to throw fuzzy sets into the mix, another type of set with useful applications. The result could be called a polymorphic approach to modeling various types of sets in Ruby. This series of posts is a tutorial-style presentation of what I came up with. If you don't care much for lengthy explanations, head [straight to Github](https://github.com/benrodenhaeuser/sets) to have a look at the code.

The series has three parts:

- This part introduces our topic by discussing the three types of sets we would like to capture.
- [Part 02](/2017/12/18/modeling-sets/) develops a unified model for those types of sets.
- [Part 03](/2017/12/19/operations-on-sets/) discusses how to implement the typical operations on sets in this model.

## Classical sets, multisets, and fuzzy sets

Let's first get an overview of the types of collections we are interested in by means of some quick examples.

### Classical Sets

Supppose we wanted to concisely represent the letters occuring in a word, while disregarding their sequential order as well as the number of times they occur in the word. A classical set would be a good choice of data structure for this task. For instance, the word "learner" could be represented by the set

> `{ a, e, l, r, n }`.

The word "learn" corresponds to the same classical set, as it contains the same letters. The word "land", on the other hand, corresponds to the set

> `{ a, l, n, d }`.


Taking the intersection of the two sets, which collects the elements occuring in both of them, we obtain the set `{ a, l, n }`, which captures the overlap of the two words in terms of letters contained—a crude measure of what they have in common. So sets allow us to zoom in on questions of membership, while disregarding other aspects of particular entities we wish to study.

### Multisets

Suppose now we would like to count *how often* letters occur in a given word or text, while (still) disregarding their order. A multiset would be an appropriate data structure to accomplish this. For example, the above word "learner" corresponds to the multiset

> `{ a, e, e, l, r, r, n }`.

Notice that the word "learn" would be represented by a different multiset, namely

> `{ a, e, l, r, n }`.

So multisets make finer distinctions than classical sets.

A more concise way to represent a multiset is by means of key-value notation. In this notation, our multiset representation of the word "learner" would be written as

> `{ a: 1, e: 2, l: 1, r: 2, n: 1 }`

In a programming context, the elements of a set (be it a classical set or a multiset) are often called *keys*. The above multiset has five distinct keys: "a", "e", "l", "r" and "n". In a multiset, each key comes with a count, the value associated with the key, which we will refer to as the *score* for that key. The score for the key "e" in the above multiset, for example, is 2.

### Fuzzy sets

Fuzzy sets also make finer distinctions compared to classical sets. However, they generalize classical sets in a different direction. As we just saw, in a multiset, the score for a particular key represents *multiplicity* of membership (how many times does the key occur in the set?). In a fuzzy set, the score indicates *degree of membership*. So besides an element being "fully contained" in the set or "not contained", it may also be "partially contained" in the set, so to speak.

To see how this can be useful, take this example: consider the words "learner", "learn", "learned", and "lean". We might wish to capture how similar each of these words is to some other word, let's say the word "learner" again. The similarity of "learner" to itself is perfect, since no edit (letter change) is required to transform one into the other. They are the same, after all. On to the more interesting cases: the word "learned" is very similar to "learner" – substituting the last letter will transform the former into the latter. "learn" is also very similar to "learner", but a little less so – deleting the last two letters from "learner" results in "learner", requiring two steps rather than one. The word "lean" is again a bit less similar to "learner", requiring one additional deletion. So to transform each of the words given into "learner" requires:  

- "learner": 0 edits
- "learned": 1 edit
- "learn": 2 edits
- "lean": 3 edits

For the sake of exposition, let us settle on 3 as the—pretty arbitrarily chosen—treshold from which onwards two words to be considered completely dissimilar, or "not similar at all". Then we can map our edit counts to a scale from 0 to 1, and represent our findings as a fuzzy set which scores the key "learner" with 1.0, "learned" with 0.66, "learn" with 0.33 and "lean" with 0.0, or, using key-value notation:

> `{ learner: 1.0, learned: 0.66, learn: 0.33, lean: 0.0 }`


In this fuzzy set, the degree of each element is to be interpreted as the degree of similarity to our target word "learner".

> Continue to [part 02 of the series](/2017/12/18/modeling-sets/) where we start to put our model of sets in place.
{: .aside}

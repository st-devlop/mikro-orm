import { BigIntType, Collection, Entity, ManyToOne, MikroORM, OneToMany, PrimaryKey } from '@mikro-orm/core';
import { SchemaGenerator, AbstractSqlDriver } from '@mikro-orm/mysql';

abstract class BaseEntity  {

  @PrimaryKey({ type: BigIntType })
  id!: string;

}
@Entity()
class Author extends BaseEntity {

  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  @OneToMany(() => Book, book => book.author, { orphanRemoval: true })
  books = new Collection<Book>(this);

}

@Entity()
class Book extends BaseEntity {

  constructor(author: Author) {
    super();
    this.author = author;
  }

  @ManyToOne(() => Author, { type: BigIntType })
  author: Author;

}

describe('test orphanRemoval', () => {

  let orm: MikroORM<AbstractSqlDriver>;

  beforeEach(async () => {
    orm = await MikroORM.init({
      entities: [BaseEntity, Book, Author],
      dbName: `:memory:`,
      type: 'mysql',
      port: 3307,
    });

    const schemaGenerator = await new SchemaGenerator(orm.em);
    await schemaGenerator.ensureDatabase();
    await schemaGenerator.dropSchema();
    await schemaGenerator.createSchema();
  });

  afterEach(async () => await orm.close(true));

  test('1: Collection.set() orphan remove original items.', async () => {

    const author = new Author();
    const book = new Book(author);
    await orm.em.persistAndFlush([author, book]);

    const book2 = new Book(author);
    author.books.set([book2]);

    await orm.em.persistAndFlush(author);

    const books = await orm.em.find(Book, {});
    const authors = await orm.em.find(Author, {});

    expect(authors).toHaveLength(1);
    expect(books).toHaveLength(1);
    expect(authors[0].books[0].id).toEqual('2');
    expect(books[0].id).toEqual('2');
  });

  test('2: Collection.set() orphan remove original items in transaction.', async () => {

    const author = new Author();
    const book = new Book(author);
    await orm.em.persistAndFlush([author, book]);

    const book2 = new Book(author);
    author.books.set([book2]);

    // use transactional
    await orm.em.transactional(async em => {
      await em.persistAndFlush(author);
    });

    const books = await orm.em.find(Book, {});
    const authors = await orm.em.find(Author, {});

    expect(authors).toHaveLength(1);
    expect(books).toHaveLength(1);
    expect(authors[0].books[0].id).toEqual('2');
    expect(books[0].id).toEqual('2');
  });

});

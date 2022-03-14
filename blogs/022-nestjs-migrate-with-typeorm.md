---
title: NestJS + TypeORM 进行 Migration
slug: nestjs-migrate-with-typeorm
date: 2022-03-14
abstract: 如何将动态的 TypeORM 配置同步到数据库？
---

## 什么是 Migration

当我们使用 [ORM](https://en.wikipedia.org/wiki/Object%E2%80%93relational_mapping) 框架的时候，例如 [TypeORM](https://www.npmjs.com/package/typeorm)，我们会建立 JavaScript 类型到关系型数据库 schema 的映射。当我们建立/修改类型的时候，数据库的表也会有相应的改变。当我们运行我们的程序的时候，我们的 JS 侧会有一个数据的模型。当 JS 侧的模型和 DB 的 schema 符合的时候，我们的程序才能正常运行。所谓 Migration，也就是当 JS 侧的模型改变了，我们要运行怎样的程序才能让 DB 也进行同步的改变。

## NestJS 的 Migration 有什么问题？

在 NestJS 的文档中，明确写到 “Migration 由 TypeORM 提供的 CLI 来管理”。NestJS 并不为数据库的迁移提供任何的 API。这个时候，我们可能需要把 TypeORM 的 `orm.config.js/orm.config.json` 从服务器的代码中提取出来，然后根据共享的这份 config 来分别运行 TypeORM CLI 和我们的 NestJS 服务器。

```bash
typeorm migration:create -n PostRefactoring
```

这就会出现一个问题：假如我们的 TypeORM 中的模型依赖于运行时的数据，而这个数据无法被 CLI 所直接获得，该怎么办呢？假如我们的 entity 是通过 `autoLoadEntities` 来加载的，这些信息将无法被 TypeORM 的 config 直接获取，因为它依赖 NestJS 的依赖注入等运行时。

## 让 Server 自己解决 Migration

假如分析 Server 的进程，实际上它分成两部分：

1. 构建 AppModule。这一步包含了构建所有的依赖，自然也包括 TypeORM 的模型构建。
2. 进入等待请求，处理请求的无限循环。

```js
function bootstrap() {
  const app = await NestFactory.create(AppModule); // Step 1
  await app.listen(port); // Step 2
}

bootstrap();
```

那么答案呼之欲出，如果我们能够为 `nest start` 提供环境变量 —— `GEN_MIGRATION` —— 当然，你也可以用命令行参数而不使用环境变量，然后在 Step 1 后判断是否该选项成立，是的话则运行"生成 migration 程序"的操作。因为此时，我们**已经**拿到了所有 TypeORM 模型的信息，所以理论上我们可以在这里进行 migration 的操作。

```js
import { Connection } from 'typeorm';

function bootstrap() {
  const app = await NestFactory.create(AppModule); // Step 1

  if (process.env.GEN_MIGRATION) {
    const connection = app.get(Connection); // 拿到 TypeORM 的 connection

    await generateMigration(connection, process.env.GEN_MIGRATION);
    return;
  }

  await app.listen(port); // Step 2
}

bootstrap();
```

那么 `generateMigration` 该怎么写呢？很可惜，TypeORM 没有提供生成 migration 文件的 API。它的生成过程是[硬编码](https://github.com/typeorm/typeorm/blob/master/src/commands/MigrationGenerateCommand.ts)在 CLI 中的。也就是说，目前除了 CLI 以外没有别的 migration 生成办法……

山重水复疑无路，有时候还是方法比困难多的。既然 CLI 不提供，那我们看看 CLI 做了什么，然后照着做一遍就行嘛。阅读 TypeORM 命令行的代码 [MigrationGenerateCommand]((https://github.com/typeorm/typeorm/blob/master/src/commands/MigrationGenerateCommand.ts)，我们可以发现，关键的调用在[这里](https://github.com/typeorm/typeorm/blob/master/src/commands/MigrationGenerateCommand.ts#L112):

```js
const sqlInMemory = await connection.driver.createSchemaBuilder().log();
```

其中 `connection.driver` 是 TypeORM 的数据库驱动，也就是客户端。它是一个界面，具体实现可以是 `MysqlDriver`, `PostgresDriver` 等等，和具体的数据库一一对应。查询 `createSchemaBuilder`，它不在官方文档中，但在 API Reference 中出现了。它的作用我们也不难猜出就是生成迁移数据库的 SQL 指令。而我们需要把这些指令，合适地放入 Migration 文件中，就可以让 TypeORM 像执行它自己生成的 migration 一样执行我们的 migration 了。

具体的 make migration / migrate 代码附于下方，欢迎参考。

```ts
// utils/generateMigration.ts

// Adapted from https://github.com/typeorm/typeorm/blob/master/src/commands/MigrationGenerateCommand.ts

import { Logger } from '@nestjs/common';
import { Connection } from 'typeorm';
import * as prettier from 'prettier';
import { Query } from 'typeorm/driver/Query';
import * as fs from 'fs/promises';
import dayjs from 'dayjs';

const getTemplate = (
  name: string,
  timestamp: number,
  upSqls: string[],
  downSqls: string[],
): string => {
  const migrationName = `${name}${timestamp}`;

  return `
    const {MigrationInterface, QueryRunner} = require('typeorm');
    class ${migrationName} {
      name = '${migrationName}'
      async up(queryRunner) {
        ${upSqls.join('\n')}
      }
      async down(queryRunner) {
        ${downSqls.join('\n')}
      }
    }

    module.exports = ${migrationName};
  `;
};

const queryParams = (parameters: any[] | undefined): string => {
  if (!parameters || !parameters.length) {
    return '';
  }

  return `, ${JSON.stringify(parameters)}`;
};

export const generateMigration = async (
  connection: Connection,
  name: string,
) => {
  const queries = await connection.driver.createSchemaBuilder().log();

  if (queries.upQueries.length === 0) {
    Logger.warn('Database is up-to-date. ');
    return;
  }

  const mapSqlToJs = (query: Query) => {
    return (
      'await queryRunner.query(`' +
      query.query.replace(new RegExp('`', 'g'), '\\`') +
      '`' +
      queryParams(query.parameters) +
      ');'
    );
  };

  const upSqls: string[] = queries.upQueries.map(mapSqlToJs),
    downSqls: string[] = queries.downQueries.map(mapSqlToJs);

  const code = getTemplate(name, new Date().getTime(), upSqls, downSqls);

  const config = await prettier.resolveConfig(process.cwd());

  const formatted = prettier.format(code, {
    ...config,
    parser: 'babel-ts',
  });

  try {
    await fs.readdir('migrations');
  } catch (_) {
    await fs.mkdir('migrations', {
      recursive: true,
    });
  }
  const fileName = `migrations/${dayjs().format('YYYYMMDDHHmm')}-${name}.js`;
  await fs.writeFile(fileName, formatted);

  Logger.log(`Success! Migration file created at ${fileName}`);
};
```

```ts
// main.ts
import { NestFactory } from '@nestjs/core';
import { Config } from 'config/config';
import { Connection } from 'typeorm';
import { AppModule } from './app.module';
import { generateMigration } from './utils/generateMigration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  if (process.env.GEN_MIGRATION) {
    const connection = app.get(Connection);

    await generateMigration(connection, process.env.GEN_MIGRATION);
    return;
  }

  if (process.env.MIGRATE) {
    const connection = app.get(Connection);

    Logger.log(`process.env.MIGRATE is set, migrating...`);
    const migrations = await connection.runMigrations();

    if (migrations.length === 0) {
      Logger.warn(`Your database is up-to-date, no migrations were applied. `);
    } else {
      Logger.log(`${migrations.length} complete.`);
    }
    return;
  }

  await app.listen(3000);
}

bootstrap();
```

## 总结

NestJS 不提供 migration 的 API，TypeORM 的 migration 目前官方只支持命令行，而不支持程序化调用，给配置带来了麻烦。本文提供了一个未见于官网文档的 API 的使用方法，方便读者参考。当然，最好的办法应该是 TypeORM 提供 migration 的程序接口，并且将 NestJS 和 TypeORM 封装成一体的框架，以免重复解决相同的问题。


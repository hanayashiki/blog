import { Github } from "@components/icons/Github";
import { Npm } from "@components/icons/Npm";
import Layout from "@components/Layout";
import { ComponentChildren, h } from "preact";

interface NPMEntryProps {
  name: string,
  npmUrl?: string;
  githubUrl?: string;
  description: ComponentChildren;
}

function NPMEntry(props: NPMEntryProps) {
  const {
    name,
    npmUrl,
    githubUrl,
    description,
  } = props;

  return (
    <li>
      <div>
        <a class="link-primary mr-2">
          {name}
        </a>
        {npmUrl && (
          <a href={npmUrl} target="_blank" rel="noreferrer">
            <Npm className="inline mx-1" fill="#cb3837" />
          </a>
        )}
        {githubUrl && (
          <a href={githubUrl} target="_blank" rel="noreferrer">
            <Github className="inline mx-1" fill="white" />
          </a>
        )}
      </div>
      {description}
    </li>
  );
}

interface PublicationEntryProps {
  year: string;
  title: string;
  authors: string;
}

function PublicationEntry(props: PublicationEntryProps) {
  const {
    year,
    title,
    authors,
  } = props;

  const split = authors.split('Chenyu Wang');

  return (
    <li>
      <div>
        <span>
          {title}
        </span>

        {' '}
        ({year})
      </div>
      <div class="my-2 text-sm">
        {split[0]}
        <span class="text-primary text-sm">
          Chenyu Wang
        </span>
        {split[1]}
      </div>
    </li>
  );
}

export default function Me() {
  return (
    <Layout>
      <div className="me px-4 font-light leading-loose">
        <ol>
          <li>
            Frontend developer at
            {' '}
            <a href="https://monoid.co.jp" target="_blank" rel="noreferrer" class="link-primary">
              Monoid
            </a>
            ,
            master's student at University of Southern California.
          </li>

          <li>
            Enthusiast of all kinds of web technologies. Aimed at building performant, user-friendly and beautiful applications that empower you.
          </li>

          <br />

          <li>
            <span class="font-bold">Skills</span>
            <ol>
              <li>
                React (proficient)
              </li>
              <li>
                TypeScript (proficient)
              </li>
              <li>
                React Native (familiar)
              </li>
              <li>
                NextJS (familiar)
              </li>
              <li>
                C/C++/Python/Java/SQL (basic)
              </li>
              <li>
                Machine Learning/Natural Language Processing (basic)
              </li>
            </ol>
          </li>

          <br />

          <li>
            <span class="font-bold">Apps</span>
            <ol>
              <li>
                <a class="link-primary" href="https://wopal.dev" target="_blank" rel="noreferrer">
                  WOPAL (React Native, Bluetooth)
                </a>
              </li>
              <li>
                <a class="link-primary" href="https://starcharge.com" target="_blank" rel="noreferrer">
                  Starcharge (React, NextJS)
                </a>
              </li>
              <li>
                <a class="link-primary" href="https://member.d2dasia.com" target="_blank" rel="noreferrer">
                  D2D Member (React, Vite)
                </a>
              </li>
              <li>
                Uptime Monitor (Fullstack with React, NextJS, GraphQL)
              </li>
            </ol>
          </li>

          <br />

          <li>
            <span class="font-bold">Open Source</span>
            <ol>
              <NPMEntry
                name="tyrann-io"
                npmUrl="https://www.npmjs.com/package/tyrann-io"
                githubUrl="https://github.com/wopal-dev/tyrann-io"
                description="Typed collections of HTTP APIs."
              />

              <NPMEntry
                name="use-search"
                npmUrl="https://www.npmjs.com/package/@monoid-dev/use-search"
                githubUrl="https://github.com/MonoidDev/use-search"
                description="Handle search like you React.useState, with validation against arbitrary input"
              />

              <NPMEntry
                name="light-react"
                npmUrl="https://www.npmjs.com/package/light-react"
                githubUrl="https://github.com/hanayashiki/light-react"
                description="Easy implementation of React functions, helpful to understand how React works. "
              />

              <NPMEntry
                name="blog.chenyu.pw"
                githubUrl="https://github.com/hanayashiki/blog"
                description="Personal blog where I write arbitrary stuff, powered by esbuild, preact and tailwindcss. "
              />
            </ol>
          </li>

          <br />

          <li>
            <span class="font-bold">Publications</span>
            <ol>
              <PublicationEntry
                year="2020"
                title="MOOCCube: a large-scale data repository for NLP applications in MOOCs"
                authors="Jifan Yu, Gan Luo, Tong Xiao, Qingyang Zhong, Yuquan Wang, Wenzheng Feng, Junyi Luo, Chenyu Wang, Lei Hou, Juanzi Li, Zhiyuan Liu, Jie Tang"
              />
              <PublicationEntry
                year="2019"
                title="Course concept expansion in moocs with external knowledge and interactive game"
                authors="Jifan Yu, Chenyu Wang, Gan Luo, Lei Hou, Juanzi Li, Jie Tang, Zhiyuan Liu"
              />
              <PublicationEntry
                year="2019"
                title="ExpanRL: Hierarchical Reinforcement Learning for Course Concept Expansion in MOOCs"
                authors="Jifan Yu, Chenyu Wang, Gan Luo, Lei Hou, Juanzi Li, Jie Tang, Minlie Huang, Zhiyuan Liu"
              />

            </ol>
          </li>

          <br />

          <li>
            <span class="font-bold">Education</span>
            <ol>
              <li>
                Master's Degree in Data Science, University of Southern California, Los Angeles (2020-2021)
              </li>
              <li>
                Bachelor's Degree in Computer Science, Beihang University, Beijing (2015-2019)
              </li>
              <li>
                Research assistant in NLP at Tsinghua University (2019-2020)
              </li>
            </ol>
          </li>

          <br />

          <li>
            <span class="font-bold">Communication</span>
            <ol>
              <li>
                Chinese (native)
              </li>
              <li>
                English (advanced)
              </li>
              <li>
                Japanese (intermediate)
              </li>
            </ol>
          </li>

          <br />

          <li>
            <span class="font-bold">Contact</span>
            <ol>
              <li>
                Email:
                {' '}
                <a class="link-primary" href="mailto:wangchenyu2017@gmail.com" target="_blank" rel="noreferrer">
                  wangchenyu2017@gmail.com
                </a>
              </li>
            </ol>
          </li>
        </ol>
      </div>
    </Layout>
  );
}
